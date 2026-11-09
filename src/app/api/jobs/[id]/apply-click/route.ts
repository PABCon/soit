import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

/** Employer analytics, phase 1: a real apply-intent counter, distinct
 *  from a completed application (already counted via the `applications`
 *  table) — "clicked Apply" (or, for an external-apply-URL job, clicked
 *  through to the employer's own site) is a genuine funnel step on its
 *  own, same reasoning that made `view_count` worth tracking separately
 *  from applications in the first place. Fired from `ApplyModal`'s own
 *  click handlers, same `sendBeacon` fire-and-forget posture as
 *  `JobViewTracker`'s view counter. No auth, same reasoning as the view
 *  route: any real visitor's click counts, the admin client is only
 *  because `jobs.apply_click_count` isn't in a client-reachable grant. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 400 });

  const admin = createAdminClient();
  await admin.rpc("increment_job_apply_click", { target_job_id: id });

  return new Response(null, { status: 204 });
}
