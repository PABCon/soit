import {
  getStalledImportRuns,
  incrementStalledResumes,
  completeImportRun,
  resolveCompanyRecipient,
  MAX_STALLED_RESUMES,
} from "@/lib/db/job-imports";
import { runImportBatch, triggerImportBatch } from "@/lib/jobs/run-import-batch";
import { sendEmail } from "@/lib/email/send";
import { jobImportSummaryEmail } from "@/lib/email/templates/job-import-summary";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronRequest } from "@/lib/cron-auth";

// Same reasoning as the process route — this can end up running one real
// batch per stalled import it finds.
export const maxDuration = 60;

/**
 * Safety net, not the primary driver — normal progress happens via
 * self-chaining (see run-import-batch.ts). This only matters when that
 * chain breaks somewhere (the "trigger the next batch" step itself
 * failed) and a `running` import has gone quiet. Runs once daily, this
 * project's own Vercel plan ceiling for native Cron Jobs — see
 * job-imports.ts's STALL_THRESHOLD_MINUTES for why that's fine (any
 * import still progressing normally never shows up in this query at all).
 */
export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stalled = await getStalledImportRuns();
  const results: { runId: string; action: string }[] = [];

  for (const run of stalled) {
    const resumes = await incrementStalledResumes(run.id);
    if (resumes > MAX_STALLED_RESUMES) {
      await completeImportRun(run.id, "failed");
      const admin = createAdminClient();
      const { data: company } = await admin.from("companies").select("company_name").eq("id", run.company_id).maybeSingle();
      const recipient = await resolveCompanyRecipient(run.company_id);
      if (recipient) {
        await sendEmail(
          jobImportSummaryEmail({
            to: recipient,
            companyName: company?.company_name ?? "there",
            importedCount: run.imported_count,
            skippedCount: run.skipped_count,
            failedCount: run.failed_count,
          }),
        );
      }
      results.push({ runId: run.id, action: "gave_up" });
      continue;
    }

    // Process one batch now, and — if there's still more to do — re-trigger
    // the normal self-chaining cadence so this import goes back to
    // finishing in minutes/hours rather than being stuck resuming once a
    // day indefinitely.
    const result = await runImportBatch(run.id);
    if (!result.done) triggerImportBatch(run.id);
    results.push({ runId: run.id, action: "resumed" });
  }

  return Response.json({ checked: stalled.length, results });
}
