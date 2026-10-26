"use server";

import { getMyEmployerContext } from "@/lib/db/companies";
import { extractJobLinksFromUrl } from "@/lib/ai/extract-job-links";
import { canStartJobImport, createImportRun, resolveCompanyRecipient } from "@/lib/db/job-imports";
import { triggerImportBatch } from "@/lib/jobs/run-import-batch";
import { sendEmail } from "@/lib/email/send";
import { jobImportStartedEmail } from "@/lib/email/templates/job-import-started";

export type StartJobImportResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_an_employer" | "already_running" | "cooldown" | "invalid_url" | "fetch_failed" | "no_jobs_found" | "extraction_failed";
      retryAfter?: string;
    };

/** §job-import — kicks off a new import run: discovers the job links on
 *  the given listing page (the one piece of work that only ever happens
 *  once per run), creates the run record, sends the "started" email, and
 *  fires the first batch. Everything after this point is self-chaining
 *  (run-import-batch.ts) — this function returns as soon as the first
 *  batch has been triggered, not once the import actually finishes. */
export async function startJobImportAction(sourceUrl: string): Promise<StartJobImportResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const eligibility = await canStartJobImport(ctx.company.id);
  if (!eligibility.ok) return { ok: false, reason: eligibility.reason, retryAfter: eligibility.retryAfter };

  const discovery = await extractJobLinksFromUrl(sourceUrl);
  if (!discovery.ok) {
    if (discovery.reason === "invalid_url") return { ok: false, reason: "invalid_url" };
    if (discovery.reason === "fetch_failed" || discovery.reason === "too_large") return { ok: false, reason: "fetch_failed" };
    return { ok: false, reason: "extraction_failed" };
  }
  if (discovery.links.length === 0) return { ok: false, reason: "no_jobs_found" };

  const run = await createImportRun(ctx.company.id, sourceUrl, discovery.links);

  const recipient = await resolveCompanyRecipient(ctx.company.id);
  if (recipient) {
    await sendEmail(
      jobImportStartedEmail({
        to: recipient,
        companyName: ctx.company.company_name,
        sourceUrl,
        foundCount: discovery.links.length,
      }),
    );
  }

  triggerImportBatch(run.id);

  return { ok: true };
}
