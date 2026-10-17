import type { BadgeVariant } from "@/components/Badge";
import type { MyApplication } from "@/lib/db/applications";

/** Shared between the aggregated applicants list and the applicant
 *  detail page, so a status always reads the same color everywhere. */
export const APPLICANT_STATUS_BADGE: Record<MyApplication["status"], BadgeVariant> = {
  applied: "info",
  viewed: "pending",
  responded: "positive",
  rejected: "negative",
  closed: "neutral",
};
