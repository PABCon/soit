import { getResignationRuleSet } from "../rules/loader";
import { calculateSeniority } from "./seniority";
import { d, round2 } from "./money";
import type { ResignationInput, ResignationResult } from "./types";

/** CT art. 400.º (required notice) + art. 401.º (the automatic
 *  compensation owed to the employer for a shortfall, no need to prove
 *  actual damages). The employee-resignation case: near-zero real search
 *  demand per the Keyword Planner pull this feature was scoped from, so
 *  it's present but not the headline scenario. */
export function calculateResignationNotice(input: ResignationInput): ResignationResult {
  const rules = getResignationRuleSet(input.profile.cessationDate);
  const seniority = calculateSeniority(input.profile.contractStartDate, input.profile.cessationDate);

  let noticeDaysRequired: number;
  if (input.contractType === "fixed_term") {
    const durationMonths = input.fixedTermOriginalDurationMonths ?? 0;
    noticeDaysRequired =
      durationMonths < rules.fixedTermContractDurationThresholdMonths
        ? rules.fixedTermNoticeDaysShortContract
        : rules.fixedTermNoticeDaysLongContract;
  } else {
    noticeDaysRequired =
      seniority.fullYears <= rules.openEndedTenureThresholdYears
        ? rules.openEndedNoticeDaysShortTenure
        : rules.openEndedNoticeDaysLongTenure;
  }

  const shortfallDays = Math.max(0, noticeDaysRequired - input.noticeDaysPlanned);
  const dailyRemuneration = round2(d(input.profile.monthlyRemuneration).div(30));
  const compensationOwed = round2(d(dailyRemuneration).times(shortfallDays));

  return {
    noticeDaysRequired,
    noticeDaysPlanned: input.noticeDaysPlanned,
    shortfallDays,
    dailyRemuneration,
    compensationOwed,
  };
}
