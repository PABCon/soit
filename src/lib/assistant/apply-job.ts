import { getApplyStatus, applyToJob, type ApplyResult } from "@/lib/db/applications";
import type { Job } from "@/lib/types";

/**
 * Apply-via-chat, split into a preview step and a confirm step per the
 * explicit "yes/no, not a button, not silent" requirement: the model
 * is instructed (system prompt) to describe exactly what `previewApply`
 * returns and wait for an unambiguous affirmative before ever calling
 * `confirmApply`.
 *
 * Both wrap the real `applications.ts` functions directly, no new
 * auth/validation logic. `getApplyStatus`/`applyToJob` already resolve
 * the candidate themselves via `my_candidate_id()` (RLS-scoped),
 * returning `isCandidate: false`/`not_candidate` for anyone without a
 * session; there is no argument path here for a model-supplied
 * candidate id. `job` is always the real, already-fetched `Job` object
 * the route looked up from its own `allJobs` list (the same array
 * `searchJobs` already searches) by the id the model supplied, title/
 * company name shown in the preview are never the model's own text.
 */
export type PreviewApplyResult =
  | { ok: false; reason: "needs_account" }
  | { ok: false; reason: "already_applied"; jobTitle: string; companyName: string }
  | { ok: false; reason: "no_cv_on_file"; jobTitle: string; companyName: string }
  | { ok: true; jobTitle: string; companyName: string; cvKind: "pdf" | "docx" };

/** The route's own `previewApply` tool `execute` adds a `job_not_found`
 *  branch (when the model's `jobId` doesn't match anything in the
 *  already-fetched `allJobs` list) before ever calling `previewApply`
 *  itself, exported here so the client can cast `part.output` to a
 *  real type, same convention as `SearchJobsResult`. */
export type PreviewApplyToolResult = PreviewApplyResult | { ok: false; reason: "job_not_found" };

export async function previewApply(job: Job): Promise<PreviewApplyResult> {
  const status = await getApplyStatus(job.id);
  if (!status.isCandidate) return { ok: false, reason: "needs_account" };
  if (status.alreadyApplied) {
    return { ok: false, reason: "already_applied", jobTitle: job.title, companyName: job.company.name };
  }
  if (!status.storedCv) {
    return { ok: false, reason: "no_cv_on_file", jobTitle: job.title, companyName: job.company.name };
  }
  return { ok: true, jobTitle: job.title, companyName: job.company.name, cvKind: status.storedCv.kind };
}

/** Only ever called after the user's own explicit confirmation (system
 *  prompt instruction), and even then, re-validates everything itself
 *  by calling the real `applyToJob()`, which never trusts a prior
 *  preview as still accurate (job could have expired, the daily cap
 *  could have been hit by another action, in the moments between). */
export async function confirmApply(jobSlug: string, coverNote?: string): Promise<ApplyResult> {
  return applyToJob(jobSlug, { kind: "stored" }, coverNote ?? "");
}
