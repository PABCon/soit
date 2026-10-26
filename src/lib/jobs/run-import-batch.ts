import { createAdminClient } from "@/lib/supabase/admin";
import { saveJob, type TypeSalaryInput } from "@/lib/db/jobs";
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
  acquireImportRunLock,
  advanceImportRun,
  completeImportRun,
  getImportRun,
  isSourceAlreadyImported,
  recordImportedSource,
  releaseImportRunLock,
  remainingImportBudget,
  resolveCompanyRecipient,
} from "@/lib/db/job-imports";

/** Real incident, 2026-10-26: a batch was killed mid-loop by Vercel's 60s
 *  function limit (process/route.ts's `maxDuration`) after 5 real jobs had
 *  already been created — but progress used to be written to the database
 *  only ONCE, after the whole loop finished, so the run looked exactly
 *  like it had never started (next_index/imported_count stuck at 0)
 *  despite 5 real drafts existing. This is the fix: stop voluntarily with
 *  real margin before the hard limit, so the function always gets to
 *  finish its own bookkeeping and hand off to the next batch cleanly,
 *  rather than being killed mid-write. */
const SOFT_TIME_BUDGET_MS = 40_000;

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

/** Processes up to BATCH_SIZE links (fewer if the soft time budget runs out
 *  first) and decides whether to keep going. Called by the process-batch
 *  route (normal self-chaining flow) and by the daily safety-net cron
 *  (resuming a run whose chain genuinely broke) — identical logic either
 *  way. Every single link's outcome is persisted to the database
 *  immediately, not batched until the end — the only way to guarantee the
 *  run's own progress always matches reality regardless of exactly when
 *  (or whether) this invocation gets cut off. */
export async function runImportBatch(runId: string): Promise<{ done: boolean }> {
  const run = await getImportRun(runId);
  if (!run || run.status !== "running") return { done: true };

  // Real incident, 2026-10-26: a manual resume overlapped with this run's
  // own self-chained continuation and both processed the same link at
  // once, creating a duplicate job. Whoever doesn't win this claim backs
  // off immediately, doing no work at all — the run is still "running",
  // just being handled by the invocation that already holds the lock.
  if (!(await acquireImportRunLock(runId))) return { done: false };

  try {
    return await processBatch(run);
  } finally {
    await releaseImportRunLock(runId);
  }
}

async function processBatch(run: NonNullable<Awaited<ReturnType<typeof getImportRun>>>): Promise<{ done: boolean }> {
  const runId = run.id;
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

  const batchStartedAt = Date.now();
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  for (const link of slice) {
    if (Date.now() - batchStartedAt > SOFT_TIME_BUDGET_MS) break;

    let outcome: "imported" | "skipped" | "failed";
    let newJobId: string | null = null;

    if (await isSourceAlreadyImported(run.company_id, link.url)) {
      outcome = "skipped";
    } else {
      const extracted = await extractJobFromUrl(link.url, { categoryLabels: jobCategories.map((c) => c.label) });
      if (!extracted.ok) {
        outcome = "failed";
      } else {
        try {
          const resolved = await resolveExtractedJobVocab(extracted.data, vocab, run.company_id, company.company_name);
          // Real-usage finding: a source posting stated two distinct
          // contract types, each with its own range (one gross B2B rate,
          // one net permanent-contract rate) — extraction now attributes
          // each correctly instead of conflating them (see
          // extract-job.ts's own prompt). `contractSalaries[0]` already
          // mirrors the flat `salaryMin`/`salaryMax`/`employmentType`
          // fields above when it's set, so this only adds the *extra*
          // types' own ranges on top.
          const employmentTypes =
            extracted.data.contractSalaries.length > 0
              ? [...new Set(extracted.data.contractSalaries.map((cs) => cs.employmentType))]
              : [extracted.data.employmentType ?? "permanent"];
          const typeSalaries: Partial<Record<(typeof employmentTypes)[number], TypeSalaryInput>> = {};
          for (const cs of extracted.data.contractSalaries.slice(1)) {
            typeSalaries[cs.employmentType] = {
              salaryMin: cs.salaryMin,
              salaryMax: cs.salaryMax,
              salaryPeriod: cs.salaryPeriod,
              salaryMonths: null,
              salaryBasis: cs.salaryBasis,
            };
          }
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
              salaryBasis: extracted.data.contractSalaries[0]?.salaryBasis ?? "gross",
              employmentTypes,
              typeSalaries,
              techTags: resolved.techTags,
              languages: resolved.languages,
              // Defaults to the page it was scraped from, so a candidate
              // who applies before the employer has reviewed the draft
              // still ends up on a real, working apply flow (the
              // employer's own original posting). Clearing this field in
              // the edit form switches to Just IT's normal internal apply
              // flow, same as any other job.
              externalApplyUrl: link.url,
              expiresAt: null,
              publish: false,
              salaryPublic: true,
            },
            { companyId: run.company_id },
          );
          newJobId = result.id;
          outcome = "imported";
        } catch (err) {
          console.error("job-import: saveJob failed for", link.url, (err as Error).message);
          outcome = "failed";
        }
      }
    }

    // Recorded in this exact order deliberately: if the function dies
    // between these two lines, the dedup row already exists, so a resume
    // re-checking this same link (next_index not yet advanced past it)
    // correctly skips it as already-imported instead of creating a
    // duplicate — the one-item gap self-heals on the very next attempt.
    if (outcome === "imported" && newJobId) {
      await recordImportedSource(run.company_id, link.url, newJobId);
    }
    processed++;
    if (outcome === "imported") imported++;
    else if (outcome === "skipped") skipped++;
    else failed++;
    await advanceImportRun(runId, {
      nextIndex: run.next_index + processed,
      importedDelta: outcome === "imported" ? 1 : 0,
      skippedDelta: outcome === "skipped" ? 1 : 0,
      failedDelta: outcome === "failed" ? 1 : 0,
    });
  }

  const nextIndex = run.next_index + processed;
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
