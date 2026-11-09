import type { BadgeVariant } from "@/components/Badge";
import type { CandidateBucket } from "@/lib/db/application-stages";

/** Shared between the aggregated applicants list and the applicant
 *  detail page, so a stage always reads the same color everywhere.
 *  Colored by `candidateBucket`, not by a company's own custom stage
 *  label (which is free text now, not a fixed enum this could key off
 *  of): the bucket stays a small, fixed set regardless of how a company
 *  names their stages. A match-origin row (Phase 4 matchmaking) has no
 *  bucket at all, badged separately (a plain "Connected" badge, not
 *  part of this lookup). */
export const BUCKET_BADGE: Record<CandidateBucket, BadgeVariant> = {
  submitted: "info",
  in_review: "pending",
  not_selected: "negative",
  hired: "positive",
};
