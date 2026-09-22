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

  const { landingPath } = await completeRegistration(data.user);
  const locale = next.split("/")[1] || "pt";
  return NextResponse.redirect(`${origin}/${locale}${landingPath}`);
}
