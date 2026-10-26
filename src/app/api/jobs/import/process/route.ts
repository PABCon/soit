import { after } from "next/server";
import { runImportBatch, triggerImportBatch } from "@/lib/jobs/run-import-batch";

// Hobby-plan function duration ceiling is 60s by default; a batch of up to
// BATCH_SIZE jobs (each a real page fetch + an LLM call) stays comfortably
// inside this at the current batch size — see job-imports.ts's own
// comment on BATCH_SIZE for the sizing reasoning.
export const maxDuration = 60;

/** Internal-only — processes exactly one batch, then (if there's more to
 *  do) fires the next one itself via the same `after()`-then-fallback
 *  pattern this codebase already uses for every other non-blocking,
 *  fire-and-forget step. This is what makes a whole import finish in
 *  minutes/hours instead of needing an external scheduler to pace it. */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { runId } = (await request.json()) as { runId?: string };
  if (!runId) return new Response("Missing runId", { status: 400 });

  const result = await runImportBatch(runId);

  if (!result.done) {
    try {
      after(() => triggerImportBatch(runId));
    } catch {
      triggerImportBatch(runId);
    }
  }

  return Response.json(result);
}
