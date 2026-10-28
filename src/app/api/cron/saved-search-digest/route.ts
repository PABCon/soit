import { runSavedSearchDigest } from "@/lib/notifications/saved-search-digest";
import { verifyCronRequest } from "@/lib/cron-auth";

/**
 * Vercel Cron target (see vercel.json's `crons`), once daily. Vercel signs
 * every cron-triggered request with `Authorization: Bearer $CRON_SECRET`
 * when that env var is set — checked here so this route can't be hit by
 * anyone who finds the URL and force a mass email send on demand.
 */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runSavedSearchDigest();
  return Response.json(result);
}
