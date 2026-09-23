import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeRegistration } from "@/lib/auth/complete-registration";

/**
 * Single redirect target for email-link confirmation and OAuth (§9.1, §9.2).
 * Deliberately outside [locale] — the locale is threaded through as `next`
 * on the redirectTo URL passed to signUp/signInWithOAuth.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/pt/jobs";

  if (!code) return NextResponse.redirect(`${origin}${next}`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/pt/employer/login?error=auth`);
  }

  // A password-recovery link exchanges a real session here too, but must
  // never run completeRegistration/land on the normal role-based page — it
  // has to reach the "set a new password" step. resetPasswordForEmail's
  // redirectTo carries `type=recovery` for exactly this branch.
  if (searchParams.get("type") === "recovery") {
    return NextResponse.redirect(`${origin}${next}`);
  }

  // Role intent (§6.4a): email/password signUp() already carries it in
  // user_metadata.last_role; OAuth has no metadata channel at sign-in
  // time, so AuthForm passes it as an explicit `role` query param on the
  // redirectTo instead. Defaulting to "candidate" matches this route's
  // long-standing implicit behavior when neither is present.
  const intendedRole = (searchParams.get("role") ?? data.user.user_metadata?.last_role ?? "candidate") as
    | "employer"
    | "candidate";
  const { landingPath } = await completeRegistration(data.user, intendedRole);
  const locale = next.split("/")[1] || "pt";
  return NextResponse.redirect(`${origin}/${locale}${landingPath}`);
}
