import { toggleFavorite } from "@/lib/db/favorites";
import type { Job } from "@/lib/types";

/**
 * Save/unsave a job as a chat tool, same shape as `apply-job.ts`: a
 * thin wrapper around the real `favorites.ts` function, no new auth or
 * validation logic. `toggleFavorite()` already resolves the candidate
 * itself via `my_candidate_id()` (RLS-scoped) and throws when there is
 * none, there is no argument path here for a model-supplied candidate
 * id. `job` is always the real, already-fetched `Job` object the route
 * looked up from its own `allJobs` list by the id the model supplied,
 * the title/company name echoed back are never the model's own text.
 */
export type ToggleFavoriteResult =
  | { ok: false; reason: "needs_account" }
  | { ok: true; favorited: boolean; jobTitle: string; companyName: string };

export async function toggleFavoriteForJob(job: Job): Promise<ToggleFavoriteResult> {
  try {
    const { favorited } = await toggleFavorite(job.id);
    return { ok: true, favorited, jobTitle: job.title, companyName: job.company.name };
  } catch {
    // toggleFavorite() throws a plain Error("Not a candidate") rather
    // than returning a typed result, same as every other candidate-only
    // db/* function predating this chat feature. Caught here and turned
    // into the same needs_account signal previewApply already uses, so
    // the client can render the identical InlineAuthCard either way.
    return { ok: false, reason: "needs_account" };
  }
}

/** The route's own `toggleFavorite` tool `execute` adds a `job_not_found`
 *  branch (when the model's `jobId` doesn't match anything in the
 *  already-fetched `allJobs` list) before ever calling
 *  `toggleFavoriteForJob` itself, exported here so the client can cast
 *  `part.output` to a real type, same convention as `PreviewApplyToolResult`. */
export type ToggleFavoriteToolResult = ToggleFavoriteResult | { ok: false; reason: "job_not_found" };
