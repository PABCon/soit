"use server";

import { createClient } from "@/lib/supabase/server";
import { createCvReview, claimCvReview, type CreateCvReviewResult, type ClaimCvReviewResult } from "@/lib/db/cv-review";

export type { CreateCvReviewResult, ClaimCvReviewResult };

/** No auth required — but when a session already exists (the Rail's own
 *  "CV Score" link means a logged-in candidate reaches this page just as
 *  often as an anonymous visitor now), the upload auto-claims immediately
 *  instead of making an already-authenticated candidate go through a
 *  registration prompt for an account they already have. See
 *  cv-review.ts's own doc comment for the real bug this fixes. */
export async function reviewCvAction(formData: FormData): Promise<CreateCvReviewResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, reason: "file_too_large" };
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");

  return createCvReview(bytes, candidateId);
}

export type ClaimActionResult = ClaimCvReviewResult | { ok: false; reason: "not_a_candidate" };

/** Called from the results page once a real session exists — either just
 *  after registering (via the `next=` redirect AuthForm already threads
 *  through email confirmation) or on a later revisit of the same link. */
export async function claimCvReviewAction(token: string): Promise<ClaimActionResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };
  return claimCvReview(candidateId, token);
}
