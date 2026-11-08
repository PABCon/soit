import type { BadgeVariant } from "@/components/Badge";
import type { Applicant } from "@/lib/db/applications";

/** Shared between the aggregated applicants list and the applicant
 *  detail page, so a status always reads the same color everywhere.
 *  Matchmaking rework, Phase 4: `"connected"` isn't a real application
 *  pipeline state, it's the fixed sentinel a connected-but-never-applied
 *  candidate row carries, so it gets its own entry here rather than
 *  being forced into one of the five real statuses it isn't. Reuses the
 *  `match` badge variant, the same visual language `/recruit/
 *  matchmaking`'s own badges already use for this feature. */
export const APPLICANT_STATUS_BADGE: Record<Applicant["status"], BadgeVariant> = {
  applied: "info",
  viewed: "pending",
  responded: "positive",
  rejected: "negative",
  closed: "neutral",
  connected: "match",
};
