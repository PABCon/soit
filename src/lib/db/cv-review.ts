import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { sniffFileType } from "@/lib/file-sniff";
import { extractCvText } from "@/lib/cv-text";
import { scoreCvQuality, type CvQualityScore } from "@/lib/ai/cv-quality-score";

const MAX_CV_BYTES = 5 * 1024 * 1024; // 5MB, same cap applications.ts already uses
const REVIEW_TTL_DAYS = 14; // long enough to register later the same week, short
// enough an abandoned anonymous upload doesn't linger indefinitely

/** Same shape as claim-invites.ts' own token — 32 bytes, base64url, safe
 *  as a bare URL path/query segment with no escaping. */
function generateReviewToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateCvReviewResult =
  | { ok: true; token: string; overallScore: number; claimed: boolean }
  | { ok: false; reason: "file_too_large" | "bad_file" | "empty_content" | "generation_failed" };

/**
 * The "upload your CV, get scored instantly" entry point — reachable both
 * anonymously (the growth-loop case this was originally built for) and by
 * an already-logged-in candidate (once the Rail's own "CV Score" nav link
 * made that the much more common path for a returning visitor). A real
 * bug, caught by the user's own testing, not any automated check: a
 * logged-in candidate uploading here still got the anonymous "create an
 * account" prompt — nothing ever checked whether a session already
 * existed. `candidateId`, when the caller already has one, makes this
 * claim itself immediately rather than leaving it to be claimed later —
 * `claimed: true` in the result tells the client to skip the registration
 * interstitial entirely and go straight to the full breakdown. For a
 * genuinely anonymous upload (`candidateId` omitted), behavior is
 * unchanged from before: only the headline `overallScore` ever reaches
 * the client until a real account claims the token.
 */
export async function createCvReview(bytes: Uint8Array, candidateId?: string | null): Promise<CreateCvReviewResult> {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_CV_BYTES) return { ok: false, reason: "file_too_large" };

  const kind = sniffFileType(bytes);
  if (!kind) return { ok: false, reason: "bad_file" };

  const text = await extractCvText(bytes, kind);
  if (!text) return { ok: false, reason: "bad_file" };

  const scored = await scoreCvQuality(text);
  if (!scored.ok) return { ok: false, reason: scored.reason };

  const admin = createAdminClient();
  const token = generateReviewToken();
  const expiresAt = new Date(Date.now() + REVIEW_TTL_DAYS * 864e5);
  const now = new Date().toISOString();
  const { error } = await admin.from("cv_review_results").insert({
    token,
    overall_score: scored.data.overallScore,
    result: scored.data,
    cv_text: text,
    expires_at: expiresAt.toISOString(),
    ...(candidateId ? { candidate_id: candidateId, claimed_at: now } : {}),
  });
  if (error) throw new Error(`cv review creation failed: ${error.message}`);

  return { ok: true, token, overallScore: scored.data.overallScore, claimed: Boolean(candidateId) };
}

export type CvReviewPreview = { overallScore: number; claimed: boolean };

/**
 * Pre-claim preview — just enough for the "create an account to see your
 * full results" prompt to show the headline number again if the page is
 * reloaded, never the full breakdown. Returns null for an unknown or
 * expired token (same honesty-over-silent-failure convention as
 * getClaimPreview).
 */
export async function getCvReviewPreview(token: string): Promise<CvReviewPreview | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cv_review_results")
    .select("overall_score, claimed_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  return { overallScore: data.overall_score, claimed: data.claimed_at !== null };
}

export type ClaimCvReviewResult =
  | { ok: true; overallScore: number; result: CvQualityScore }
  | { ok: false; reason: "not_found" | "expired" | "claimed_by_other" };

/**
 * Attaches an anonymous review to the real candidate who just registered
 * (or logged in) and clicked through — idempotent for the same candidate
 * re-visiting their own results link, but rejects a token someone else
 * already claimed, the same "don't let a second party silently take over
 * a first party's result" boundary getClaimPreview's own company-claim
 * counterpart doesn't need (a company claim can only ever be clicked by
 * whoever has the emailed link once; a CV review link is far more likely
 * to be reused by its own owner across a session).
 */
export async function claimCvReview(candidateId: string, token: string): Promise<ClaimCvReviewResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("cv_review_results")
    .select("candidate_id, overall_score, result, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!data) return { ok: false, reason: "not_found" };
  if (new Date(data.expires_at) < new Date()) return { ok: false, reason: "expired" };
  if (data.candidate_id && data.candidate_id !== candidateId) return { ok: false, reason: "claimed_by_other" };

  if (!data.candidate_id) {
    await admin
      .from("cv_review_results")
      .update({ candidate_id: candidateId, claimed_at: new Date().toISOString() })
      .eq("token", token);
  }

  return { ok: true, overallScore: data.overall_score, result: data.result as CvQualityScore };
}
