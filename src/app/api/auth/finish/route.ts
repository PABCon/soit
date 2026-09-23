import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeRegistration } from "@/lib/auth/complete-registration";

/**
 * Covers the case where signUp already returns an active session (email
 * confirmation disabled on the project) — /auth/callback only fires for the
 * email-link and OAuth round trips. The register form calls this
 * immediately after signUp when `data.session` is already present.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  // signUp() already set user_metadata.last_role moments ago on this exact
  // call — always present on this path (§6.4a).
  const intendedRole = (user.user_metadata?.last_role ?? "candidate") as "employer" | "candidate";
  const { landingPath } = await completeRegistration(user, intendedRole);
  return NextResponse.json({ landingPath });
}
