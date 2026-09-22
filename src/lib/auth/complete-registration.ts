import { after } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { logEvent } from "@/lib/events";
import { verifyCompany } from "@/lib/verification/verify-company";
import { slugify } from "@/lib/slug";

type Role = "employer" | "candidate";

/**
 * Runs once per user, the first time their session is established after
 * registration (email link click, OAuth callback, or an immediate session
 * if email confirmation is disabled on the project). Creates the profile
 * row for the role chosen at the entry point (§6.4) and, for candidates,
 * performs the §6.5 claim: an existing unclaimed row (from an earlier
 * anonymous apply) is linked only now, never before.
 *
 * Idempotent — safe to call more than once for the same user (a second
 * OAuth round trip, a retried request): each branch checks for an existing
 * row before creating one.
 */
export async function completeRegistration(user: User): Promise<{ role: Role; landingPath: string }> {
  const admin = createAdminClient();
  const meta = user.user_metadata ?? {};
  const email = (user.email ?? "").toLowerCase();

  const { data: existingEmployer } = await admin
    .from("employer_users")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  const { data: existingCandidate } = await admin
    .from("candidates")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!existingEmployer && !existingCandidate) {
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
      return { role: "employer", landingPath: "/recruit" };
    }
  }

  if (!existingEmployer && !existingCandidate && meta.pending_nif) {
    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        company_name: meta.pending_company_name || email.split("@")[0],
        slug: slugify(meta.pending_company_name || email),
        nif: meta.pending_nif,
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
      after(() => verifyCompany(company.id, meta.pending_nif));
    } catch {
      void verifyCompany(company.id, meta.pending_nif);
    }

    return { role: "employer", landingPath: "/recruit" };
  }

  if (existingEmployer) {
    return { role: "employer", landingPath: "/recruit" };
  }

  if (existingCandidate) {
    return { role: "candidate", landingPath: "/jobs" };
  }

  // Candidate path: claim an unclaimed row from an earlier anonymous apply
  // (§6.5), or create a freshly-claimed one for a direct registration.
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

  return { role: "candidate", landingPath: "/jobs" };
}
