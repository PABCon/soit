import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureEmployerProfile, ensureCandidateProfile } from "@/lib/auth/complete-registration";

/**
 * Same-email dual-role attach (§6.4a): called after the client has already
 * confirmed the caller's identity via a real signInWithPassword() against
 * their *existing* account — this route only trusts the session cookie,
 * never a client-supplied user id, same as /api/auth/finish. Attaches the
 * requested role's profile to that already-authenticated user instead of
 * creating a second, independent account (which Supabase Auth's one-
 * account-per-email model doesn't support anyway).
 *
 * Also the fix for InviteAcceptForm's "login" mode, which used to sign in
 * and redirect without ever accepting the invite: it calls this with
 * `{ role: "employer" }` and no nif/companyName, and
 * ensureEmployerProfile's existing invite-by-email check picks it up.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  const body = await request.json();
  const role: "employer" | "candidate" = body.role;

  try {
    if (role === "employer") {
      const { landingPath } = await ensureEmployerProfile(user, {
        nif: body.nif,
        companyName: body.companyName,
      });
      return NextResponse.json({ landingPath });
    }

    const { landingPath } = await ensureCandidateProfile(user);
    return NextResponse.json({ landingPath });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "attach failed" }, { status: 400 });
  }
}
