import { createClient } from "@/lib/supabase/server";
import { downloadMyCv } from "@/lib/db/candidate-profile";
import { createCvReview } from "@/lib/db/cv-review";

export type ScoreCvResult =
  | { ok: false; reason: "needs_account" }
  | { ok: false; reason: "no_cv_on_file" }
  | { ok: false; reason: "file_too_large" | "bad_file" | "empty_content" | "generation_failed" }
  | { ok: true; overallScore: number; token: string };

/**
 * Chat-facing CV score, reusing the real "Analyze my CV" pipeline
 * directly (`downloadMyCv` + `createCvReview`, the same functions
 * `analyzeStoredCvAction` already uses on /profile), zero new scoring
 * logic, and no file-upload UI needed in a chat transport since the
 * candidate's already-stored CV is used. Identity resolved server-side
 * via `my_candidate_id()`, same as every other candidate-gated tool;
 * there is no argument path here for a model-supplied candidate id.
 * `candidateId` is passed straight into `createCvReview` so the result
 * is claimed immediately, never left as an anonymous token the model
 * could read back for someone else.
 */
/** The route's own tool `execute` adds a `resultUrl` (built from
 *  `token` plus `NEXT_PUBLIC_SITE_URL`/locale, both only known at the
 *  route layer, same as `calculate-salary.ts`'s `shareUrl`) to the
 *  `ok: true` case before returning. Exported here so the client can
 *  cast `part.output` to a real type, same convention as
 *  `CalculateSalaryToolResult`. */
export type ScoreCvToolResult = Exclude<ScoreCvResult, { ok: true }> | (Extract<ScoreCvResult, { ok: true }> & { resultUrl: string });

export async function scoreCv(): Promise<ScoreCvResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "needs_account" };

  const stored = await downloadMyCv();
  if (!stored) return { ok: false, reason: "no_cv_on_file" };

  const review = await createCvReview(stored.bytes, candidateId);
  if (!review.ok) return review;

  return { ok: true, overallScore: review.overallScore, token: review.token };
}
