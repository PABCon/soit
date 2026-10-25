import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveLanding } from "@/lib/auth/resolve-landing";
import { ensureEmployerProfile, DuplicateNifError } from "@/lib/auth/complete-registration";

/** Called right after signInWithPassword to decide where to land (§6.4). */
export async function POST(request: NextRequest) {
  const { preferredRole } = await request.json();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "no session" }, { status: 401 });

  let landing = await resolveLanding(supabase, user.id, preferredRole);

  // Self-heal a real failure mode: the email-confirmation link's company-
  // creation step (`ensureEmployerProfile`, normally run from
  // `/auth/callback`) can fail to ever run — most commonly, a corporate
  // email security scanner "pre-visiting" the one-time confirmation link
  // before the real person clicks it, consuming it harmlessly from the
  // scanner's own request. A person left in that state can authenticate
  // (their password is real) but has no profile at all — previously a
  // permanent dead end with nothing to retry it. `pending_nif`/
  // `pending_company_name` are only ever cleared once `ensureEmployerProfile`
  // actually succeeds (see its own comment), so their presence here is a
  // reliable signal this exact thing happened, not a guess.
  if (!landing) {
    const meta = user.user_metadata ?? {};
    if (meta.pending_nif && meta.pending_company_name) {
      try {
        await ensureEmployerProfile(user, { nif: meta.pending_nif, companyName: meta.pending_company_name });
        landing = await resolveLanding(supabase, user.id, preferredRole);
      } catch (err) {
        // A DuplicateNifError here means someone else's company already
        // holds this NIF — nothing this retry can fix; fall through to the
        // normal "no profile" response rather than surface a 500.
        if (!(err instanceof DuplicateNifError)) console.error("landing self-heal failed:", (err as Error).message);
      }
    }
  }

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
