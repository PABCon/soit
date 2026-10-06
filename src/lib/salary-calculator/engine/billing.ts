import type { BillingInput } from "./types";

/** Converts whatever billing shape the user entered into a flat monthly
 *  average — shared by Mode B's invoicing and Mode C's company revenue.
 *  Day-rate's annual day count has no confirmed default yet (spec §12
 *  flags this as still open for Paulo) — 220 working days/year is used
 *  as a documented placeholder assumption (roughly 11 months worked,
 *  holidays/bench time already netted out), not a verified figure. */
export function billingToMonthly(billing: BillingInput): number {
  if (billing.mode === "monthly") return billing.amount;
  if (billing.mode === "annual") return billing.amount / 12;
  const daysPerYear = billing.daysPerYear ?? 220;
  return (billing.amount * daysPerYear) / 12;
}

export function billingToAnnual(billing: BillingInput): number {
  return billingToMonthly(billing) * 12;
}

/** Derives the Cat B "year of activity" bucket (1, 2, or "3+") from how
 *  long the person has actually been active — one real-world fact,
 *  stated once, instead of asking for "months since start" and "year of
 *  activity" as if they were two separate decisions. */
export function deriveYearOfActivity(monthsSinceStart: number): 1 | 2 | 3 {
  if (monthsSinceStart < 12) return 1;
  if (monthsSinceStart < 24) return 2;
  return 3;
}
