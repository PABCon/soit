import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

/** Real per-job view counter (round 22) — fired client-side only, from
 *  `JobViewTracker`'s `useEffect` after a genuine page mount, never from
 *  server rendering. This project has twice shipped a bug from exactly
 *  the opposite mistake (Next `<Link>` prefetching an RSC payload for a
 *  page nobody actually visited yet) — a count incremented during
 *  render/prefetch would inflate on every hover, not just real visits.
 *  No auth: any real visitor's view counts, same as the public job page
 *  itself; the admin client is used only because `jobs.view_count` isn't
 *  in any client-reachable column grant, not because the caller needs
 *  to be privileged. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response(null, { status: 400 });

  const admin = createAdminClient();
  await admin.rpc("increment_job_view", { target_job_id: id });

  return new Response(null, { status: 204 });
}
