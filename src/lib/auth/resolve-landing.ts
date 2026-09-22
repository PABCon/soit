import type { SupabaseClient } from "@supabase/supabase-js";

type Role = "employer" | "candidate";

/**
 * §6.4: landing after login is decided by which profile rows exist, never
 * by last_role alone. If the user holds only one profile, land there. If
 * they hold both, prefer the role whose entry point they just used. Never
 * used for authorization — RLS (§6.2) is the only access control.
 *
 * Takes the caller's own session-scoped client (not the admin client):
 * checking whether you hold a profile row is a self-read RLS already
 * allows ("see colleagues" on employer_users and "own profile" on
 * candidates both permit selecting your own row), so there's no reason to
 * bypass RLS for it.
 */
export async function resolveLanding(
  supabase: SupabaseClient,
  userId: string,
  preferredRole?: Role,
): Promise<{ role: Role; landingPath: string } | null> {
  const [{ data: employer }, { data: candidate }] = await Promise.all([
    supabase.from("employer_users").select("id").eq("auth_user_id", userId).maybeSingle(),
    supabase.from("candidates").select("id").eq("auth_user_id", userId).maybeSingle(),
  ]);

  const hasEmployer = !!employer;
  const hasCandidate = !!candidate;

  if (!hasEmployer && !hasCandidate) return null;
  if (hasEmployer && preferredRole === "employer") return { role: "employer", landingPath: "/recruit" };
  if (hasCandidate && preferredRole === "candidate") return { role: "candidate", landingPath: "/jobs" };
  if (hasEmployer && !hasCandidate) return { role: "employer", landingPath: "/recruit" };
  if (hasCandidate && !hasEmployer) return { role: "candidate", landingPath: "/jobs" };

  // Holds both, and the entry point used doesn't have a matching profile
  // (shouldn't normally happen) — fall back to whichever they hold; employer
  // is the more consequential surface to not silently miss.
  return { role: "employer", landingPath: "/recruit" };
}
