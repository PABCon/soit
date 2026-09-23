import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { verifyCompany } from "@/lib/verification/verify-company";
import { slugify } from "@/lib/slug";

type Role = "employer" | "candidate";

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
  opts: { nif?: string; companyName?: string },
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

  if (companyError) throw new Error(`company creation failed: ${companyError.message}`);

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
  try {
    after(() => verifyCompany(company.id, opts.nif!));
  } catch {
    void verifyCompany(company.id, opts.nif!);
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
      full_name: meta.full_name || email.split("@")[0],
      email_verified: true,
      auth_provider: meta.pending_auth_provider || "email",
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
    });
    return { role: "employer", landingPath };
  }

  const { landingPath } = await ensureCandidateProfile(user);
  return { role: "candidate", landingPath };
}
