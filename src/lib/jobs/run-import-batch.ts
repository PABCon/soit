import { createAdminClient } from "@/lib/supabase/admin";
import { saveJob } from "@/lib/db/jobs";
import { extractJobFromUrl } from "@/lib/ai/extract-job";
import { getTechTags } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import { resolveExtractedJobVocab, type VocabLists } from "@/lib/jobs/resolve-vocab";
import { sendEmail } from "@/lib/email/send";
import { jobImportProgressEmail } from "@/lib/email/templates/job-import-progress";
import { jobImportSummaryEmail } from "@/lib/email/templates/job-import-summary";
import { SITE_URL } from "@/lib/email/site-url";
import {
  BATCH_SIZE,
  advanceImportRun,
  completeImportRun,
  getImportRun,
  isSourceAlreadyImported,
  recordImportedSource,
  remainingImportBudget,
  resolveCompanyRecipient,
} from "@/lib/db/job-imports";

/** Fires the next batch as a real HTTP request to this app's own API route
 *  rather than calling runImportBatch() directly in-process — deliberately,
 *  so each batch is its own fresh function invocation with its own clean
 *  timeout budget, never one growing call stack trying to do the whole
 *  import in a single invocation. Fire-and-forget: the caller (the process
 *  route, or the start action for the very first batch) doesn't wait for
 *  this to resolve. CRON_SECRET doubles as this route's own internal-only
 *  auth — same purpose (prove the caller is us, not a public request),
 *  no reason for a second secret. */
export function triggerImportBatch(runId: string): void {
  fetch(`${SITE_URL}/api/jobs/import/process`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.CRON_SECRET}` },
    body: JSON.stringify({ runId }),
  }).catch((err) => console.error("triggerImportBatch failed:", (err as Error).message));
}

/** Processes exactly one batch (up to BATCH_SIZE) for a run and decides
 *  whether to keep going. Called by the process-batch route (normal
 *  self-chaining flow) and by the daily safety-net cron (resuming a
 *  stalled run) — identical logic either way, since "resume" and "process
 *  the next batch" are the same operation. */
export async function runImportBatch(runId: string): Promise<{ done: boolean }> {
  const run = await getImportRun(runId);
  if (!run || run.status !== "running") return { done: true };

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("company_name, job_ad_slot_cap")
    .eq("id", run.company_id)
    .maybeSingle();
  if (!company) {
    await completeImportRun(runId, "failed");
    return { done: true };
  }

  const remainingBefore = await remainingImportBudget(run.company_id, company.job_ad_slot_cap);
  if (remainingBefore <= 0 || run.next_index >= run.discovered_links.length) {
    await finish(runId, run.company_id, company.company_name, run.imported_count, run.skipped_count, run.failed_count);
    return { done: true };
  }

  const batchSize = Math.min(BATCH_SIZE, remainingBefore, run.discovered_links.length - run.next_index);
  const slice = run.discovered_links.slice(run.next_index, run.next_index + batchSize);

  // Fetched once per batch, not per job — resolveExtractedJobVocab mutates
  // vocab.techTags in place as it auto-creates tags, so later jobs in the
  // same batch immediately see (and reuse) anything just added, rather
  // than each job re-discovering the same missing tag independently.
  const [techTags, jobCategories, spokenLanguages] = await Promise.all([
    getTechTags(),
    getJobCategories(),
    getSpokenLanguages(),
  ]);
  const vocab: VocabLists = { techTags, jobCategories, spokenLanguages };

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const link of slice) {
    if (await isSourceAlreadyImported(run.company_id, link.url)) {
      skipped++;
      continue;
    }

    const extracted = await extractJobFromUrl(link.url, { categoryLabels: jobCategories.map((c) => c.label) });
    if (!extracted.ok) {
      failed++;
      continue;
    }

    try {
      const resolved = await resolveExtractedJobVocab(extracted.data, vocab, run.company_id, company.company_name);
      const result = await saveJob(
        null,
        {
          title: extracted.data.title ?? link.title ?? "Untitled",
          description: extracted.data.description ?? "",
          language: extracted.data.adLanguage ?? "pt",
          seniority: extracted.data.seniority ?? "mid",
          workModel: extracted.data.workModel ?? "office",
          locationId: null,
          categoryId: resolved.categoryId,
          salaryMin: extracted.data.salaryMin,
          salaryMax: extracted.data.salaryMax,
          salaryPeriod: extracted.data.salaryPeriod ?? "month",
          salaryMonths: null,
          employmentTypes: [extracted.data.employmentType ?? "permanent"],
          techTags: resolved.techTags,
          languages: resolved.languages,
          // Defaults to the page it was scraped from, so a candidate who
          // applies before the employer has reviewed the draft still ends
          // up on a real, working apply flow (the employer's own original
          // posting). If they want applications collected through Just IT
          // instead, clearing this field in the edit form switches it to
          // the normal internal apply flow, same as any other job.
          externalApplyUrl: link.url,
          expiresAt: null,
          publish: false,
          salaryPublic: true,
        },
        { companyId: run.company_id },
      );
      await recordImportedSource(run.company_id, link.url, result.id);
      imported++;
    } catch (err) {
      console.error("job-import: saveJob failed for", link.url, (err as Error).message);
      failed++;
    }
  }

  const nextIndex = run.next_index + slice.length;
  await advanceImportRun(runId, { nextIndex, importedDelta: imported, skippedDelta: skipped, failedDelta: failed });

  const totalImported = run.imported_count + imported;
  if (imported > 0) {
    const recipient = await resolveCompanyRecipient(run.company_id);
    if (recipient) {
      await sendEmail(
        jobImportProgressEmail({ to: recipient, companyName: company.company_name, justImported: imported, totalImported }),
      );
    }
  }

  const remainingAfter = await remainingImportBudget(run.company_id, company.job_ad_slot_cap);
  const moreLinksLeft = nextIndex < run.discovered_links.length;
  if (remainingAfter <= 0 || !moreLinksLeft) {
    await finish(
      runId,
      run.company_id,
      company.company_name,
      totalImported,
      run.skipped_count + skipped,
      run.failed_count + failed,
    );
    return { done: true };
  }

  return { done: false };
}

async function finish(
  runId: string,
  companyId: string,
  companyName: string,
  importedCount: number,
  skippedCount: number,
  failedCount: number,
): Promise<void> {
  await completeImportRun(runId, "completed");
  const recipient = await resolveCompanyRecipient(companyId);
  if (recipient) {
    await sendEmail(jobImportSummaryEmail({ to: recipient, companyName, importedCount, skippedCount, failedCount }));
  }
}
