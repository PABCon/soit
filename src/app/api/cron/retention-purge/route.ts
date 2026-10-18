import { runRetentionPurge } from "@/lib/db/retention-purge";

/**
 * Vercel Cron target (see vercel.json's `crons`), once daily — the §6.6
 * data-retention purge job the spec calls "the one place a cron is
 * genuinely required." Same auth pattern as the saved-search digest cron:
 * Vercel signs every cron-triggered request with
 * `Authorization: Bearer $CRON_SECRET`, checked here so this route can't be
 * hit on demand by anyone who finds the URL and force an off-schedule purge.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runRetentionPurge();
  return Response.json(result);
}
