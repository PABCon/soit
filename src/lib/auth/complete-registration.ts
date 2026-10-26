import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { verifyCompany } from "@/lib/verification/verify-company";
import { ensureStripeCustomer } from "@/lib/stripe";
import { slugify } from "@/lib/slug";

type Role = "employer" | "candidate";

/** Thrown when `companies.nif`'s unique constraint rejects a registration —
 *  a real gap found in production: this used to surface as a raw "company
 *  creation failed: duplicate key value..." error with no graceful handling
 *  anywhere upstream, which could leave a real auth.users row created with
 *  no employer_users/company row behind it. Callers (the two
 *  completeRegistration entry points) catch this specifically and turn it
 *  into a translated, actionable message instead. */
export class DuplicateNifError extends Error {
  constructor(public readonly nif: string) {
    super(`A company with NIF ${nif} is already registered`);
    this.name = "DuplicateNifError";
  }
}

/**
 * Creates the employer profile for `user` if it doesn't already have one
 * (§6.4) — idempotent, safe to call more than once. Checks a pending team
 * invite by email first; otherwise creates a company from `opts.nif`/
 * `opts.companyName` and kicks off async NIF verification (§5.7.3). Used
 * both by the normal registration confirmation flow and by the same-email
 * dual-role "attach" flow (§6.4a) — an already-authenticated candidate
 * completing employer registration under the same login, not a fresh
 * signup.
 */
export async function ensureEmployerProfile(
  user: User,
  opts: { nif?: string; companyName?: string; claimToken?: string },
): Promise<{ landingPath: string }> {
  const admin = createAdminClient();
  const meta = user.user_metadata ?? {};
  const email = (user.email ?? "").toLowerCase();

  const { data: existingEmployer } = await admin
    .from("employer_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existingEmployer) return { landingPath: "/recruit" };

  const { data: invite } = await admin
    .from("employer_invites")
    .select("id, company_id, role")
    .eq("email", email)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (invite) {
    await admin
      .from("employer_users")
      .insert({ auth_user_id: user.id, company_id: invite.company_id, role: invite.role });
    await admin
      .from("employer_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, last_role: "employer" },
    });
    await logEvent("user.registered", { role: "employer", via: "invite" }, user.id);
    return { landingPath: "/recruit" };
  }

  // "Claim your profile" outreach flow (§claim-invites): the company
  // already exists — pre-built as an `unclaimed` shell, no NIF, no owner —
  // so this UPDATEs that existing row instead of INSERTing a new one.
  // Unlike a team invite, this still requires and verifies a real NIF: the
  // claim link alone only proves someone followed an email, not that
  // they're actually authorized to represent that specific business — the
  // same VIES/nif.pt check every fresh registration goes through is what
  // actually establishes that.
  if (opts.claimToken) {
    if (!opts.nif) throw new Error("No NIF available to claim this company");

    const { data: claim } = await admin
      .from("company_claim_invites")
      .select("id, company_id, expires_at, claimed_at")
      .eq("token", opts.claimToken)
      .maybeSingle();
    if (!claim || claim.claimed_at || new Date(claim.expires_at) < new Date()) {
      throw new Error("This claim link is invalid or has expired");
    }

    // The `.eq("verification_status", "unclaimed")` guard is the real
    // concurrency safety here, not `claimed_at` above (which two
    // simultaneous requests could both still read as null) — only the
    // request that actually flips this row out of `unclaimed` gets a row
    // back from `.select()`; a loser sees `updated === null` and bails
    // with a clear error instead of silently creating a second owner.
    const { data: updated, error: updateError } = await admin
      .from("companies")
      .update({ nif: opts.nif, verification_status: "unverified" })
      .eq("id", claim.company_id)
      .eq("verification_status", "unclaimed")
      .select("id, company_name")
      .maybeSingle();
    if (updateError) {
      if (updateError.code === "23505") throw new DuplicateNifError(opts.nif);
      throw new Error(`company claim failed: ${updateError.message}`);
    }
    if (!updated) throw new Error("This company has already been claimed");

    await admin
      .from("employer_users")
      .insert({ auth_user_id: user.id, company_id: claim.company_id, role: "owner" });
    await admin
      .from("company_claim_invites")
      .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
      .eq("id", claim.id);

    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...meta, last_role: "employer", pending_nif: null, pending_claim_token: null },
    });

    await logEvent("user.registered", { role: "employer", via: "claim" }, user.id);
    await logEvent("employer.nif_submitted", { company_id: claim.company_id }, user.id);

    try {
      after(() => verifyCompany(claim.company_id, opts.nif!));
    } catch {
      void verifyCompany(claim.company_id, opts.nif!);
    }
    try {
      after(() => ensureStripeCustomer(claim.company_id, updated.company_name, email || null));
    } catch {
      void ensureStripeCustomer(claim.company_id, updated.company_name, email || null);
    }

    return { landingPath: "/recruit" };
  }

  if (!opts.nif) {
    // Neither an existing profile, a matching invite, nor a NIF to create
    // one from — shouldn't happen from either real entry point, but must
    // not silently no-op and pretend to have attached a profile.
    throw new Error("No invite or NIF available to create an employer profile");
  }

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      company_name: opts.companyName || email.split("@")[0],
      slug: slugify(opts.companyName || email),
      nif: opts.nif,
      verification_status: "unverified",
    })
    .select("id")
    .single();

  if (companyError) {
    // 23505 = Postgres unique_violation — matched on the error code, not
    // the message text, since Postgres/PostgREST's wording isn't a stable
    // contract to parse against.
    if (companyError.code === "23505") throw new DuplicateNifError(opts.nif);
    throw new Error(`company creation failed: ${companyError.message}`);
  }

  await admin
    .from("employer_users")
    .insert({ auth_user_id: user.id, company_id: company.id, role: "owner" });

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, last_role: "employer", pending_nif: null, pending_company_name: null },
  });

  await logEvent("user.registered", { role: "employer" }, user.id);
  await logEvent("employer.nif_submitted", { company_id: company.id }, user.id);

  // Async layer 2 (§5.7.3) — never blocks the response the user is waiting
  // on, and never lets a failure to schedule it break registration itself.
  // The Stripe Customer creation below follows the identical pattern, for
  // the identical reason.
  try {
    after(() => verifyCompany(company.id, opts.nif!));
  } catch {
    void verifyCompany(company.id, opts.nif!);
  }

  const companyName = opts.companyName || email.split("@")[0];
  try {
    after(() => ensureStripeCustomer(company.id, companyName, email || null));
  } catch {
    void ensureStripeCustomer(company.id, companyName, email || null);
  }

  return { landingPath: "/recruit" };
}

/**
 * Creates the candidate profile for `user` if it doesn't already have one
 * (§6.4) — idempotent. Claims an existing unclaimed row from an earlier
 * anonymous apply (§6.5) if the email matches one, otherwise creates a
 * freshly-claimed one. Used both by the normal registration confirmation
 * flow and by the same-email dual-role "attach" flow.
 */
export async function ensureCandidateProfile(user: User): Promise<{ landingPath: string }> {
  const admin = createAdminClient();
  const meta = user.user_metadata ?? {};
  const email = (user.email ?? "").toLowerCase();

  const { data: existingCandidate } = await admin
    .from("candidates")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existingCandidate) return { landingPath: "/jobs" };

  // Real code gap, fixed: `meta.pending_auth_provider` is read nowhere
  // written by this codebase (the old "always resolves to 'email'" bug) —
  // `user.app_metadata.provider` is Supabase Auth's own real record of which
  // provider authenticated this user (`"email"`, `"google"`, `"github"`,
  // `"linkedin_oidc"`, `"facebook"`), set by Supabase itself, not app code.
  // OAuth providers don't agree on one metadata shape — `full_name`/`name`
  // and `avatar_url`/`picture` are the two real variants seen across
  // Google/GitHub/LinkedIn OIDC/Facebook's own `user_metadata` payloads, so
  // both are tried. Never set for a plain email/password signup, where
  // `user_metadata` carries none of these fields — the `||`/`??` fallbacks
  // leave `full_name`/`avatar_url` exactly as before for that case.
  const authProvider = user.app_metadata?.provider || "email";
  const oauthName = meta.full_name || meta.name;
  const oauthAvatar = meta.avatar_url || meta.picture;

  const { data: unclaimed } = await admin
    .from("candidates")
    .select("id")
    .eq("email", email)
    .is("auth_user_id", null)
    .maybeSingle();

  if (unclaimed) {
    await admin
      .from("candidates")
      .update({ auth_user_id: user.id, email_verified: true })
      .eq("id", unclaimed.id);
  } else {
    await admin.from("candidates").insert({
      auth_user_id: user.id,
      email,
      full_name: oauthName || email.split("@")[0],
      avatar_url: oauthAvatar || null,
      email_verified: true,
      auth_provider: authProvider,
    });
  }

  await admin.auth.admin.updateUserById(user.id, {
    user_metadata: { ...meta, last_role: "candidate" },
  });

  await logEvent("user.registered", { role: "candidate" }, user.id);

  return { landingPath: "/jobs" };
}

/**
 * Runs once per user, the first time their session is established after
 * registration (email link click, OAuth callback, or an immediate session
 * if email confirmation is disabled on the project). `intendedRole` is the
 * role this specific confirmation is for — required, not inferred from
 * "does the user have any profile yet," so a user attaching their *second*
 * role (§6.4a) is handled correctly instead of short-circuiting on their
 * first role's existing profile.
 */
export async function completeRegistration(
  user: User,
  intendedRole: Role,
): Promise<{ role: Role; landingPath: string }> {
  if (intendedRole === "employer") {
    const meta = user.user_metadata ?? {};
    const { landingPath } = await ensureEmployerProfile(user, {
      nif: meta.pending_nif,
      companyName: meta.pending_company_name,
      claimToken: meta.pending_claim_token,
    });
    return { role: "employer", landingPath };
  }

  const { landingPath } = await ensureCandidateProfile(user);
  return { role: "candidate", landingPath };
}
