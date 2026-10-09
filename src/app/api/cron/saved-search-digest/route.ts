import { runSavedSearchDigest } from "@/lib/notifications/saved-search-digest";

/**
 * Vercel Cron target (see vercel.json's `crons`), once daily. Vercel signs
 * every cron-triggered request with `Authorization: Bearer $CRON_SECRET`
 * when that env var is set — checked here so this route can't be hit by
 * anyone who finds the URL and force a mass email send on demand.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runSavedSearchDigest();
  return Response.json(result);
}
