import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveLanding } from "@/lib/auth/resolve-landing";

/** Called right after signInWithPassword to decide where to land (§6.4). */
export async function POST(request: NextRequest) {
  const { preferredRole } = await request.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "no session" }, { status: 401 });

  const landing = await resolveLanding(supabase, user.id, preferredRole);
  if (!landing) return NextResponse.json({ error: "no profile" }, { status: 404 });

  // last_role is a UX convenience for next login's role default, not
  // correctness-critical — never block the response the user is staring at
  // for a third sequential Supabase Auth round trip. Same after()-with-
  // fallback pattern already used elsewhere in this codebase (verifyCompany,
  // application-email notifications).
  try {
    after(() => supabase.auth.updateUser({ data: { last_role: landing.role } }));
  } catch {
    void supabase.auth.updateUser({ data: { last_role: landing.role } });
  }

  return NextResponse.json(landing);
}
