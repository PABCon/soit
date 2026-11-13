import { fullMonthsInCessationYear } from "./seniority";
import { d, round2 } from "./money";
import type { ProportionalEntitlementsInput, ProportionalEntitlementsResult } from "./types";

/** CT art. 245.º, owed regardless of which scenario ends the contract:
 *  proportional holiday days for the year of cessation (2 days per
 *  complete month worked), proportional Christmas subsidy (1/12 per
 *  complete month), and any already-accrued-but-untaken holiday days
 *  from a prior year, paid out in full since there's no leave schedule
 *  left to take them in.
 *
 *  A day's value uses the same monthlyRemuneration/30 convention
 *  severance.ts/fixed-term.ts already use, for one consistent
 *  methodology across every calculation in this engine.
 *
 *  Not implemented: art. 245.º's short-tenure cap (when total contract
 *  duration is under 12 months and spans two calendar years, total
 *  holiday-related pay can't exceed what's proportional to the actual
 *  contract duration, to prevent double-counting across the hire-year/
 *  exit-year boundary). This only matters for a contract that started
 *  and ended within under a year *spanning a calendar-year boundary*,
 *  flagged here rather than silently applied wrong; the common case
 *  (tenure starting and ending in different, non-adjacent years, or
 *  entirely within one calendar year) is unaffected. */
export function calculateProportionalEntitlements(
  input: ProportionalEntitlementsInput,
): ProportionalEntitlementsResult {
  const fullMonthsWorkedInCessationYear = fullMonthsInCessationYear(
    input.profile.contractStartDate,
    input.profile.cessationDate,
  );
  const dailyRate = d(input.profile.monthlyRemuneration).div(30);

  const proportionalHolidayDays = fullMonthsWorkedInCessationYear * 2;
  const proportionalHolidayPay = round2(dailyRate.times(proportionalHolidayDays));
  const proportionalChristmasSubsidy = round2(
    d(input.profile.monthlyRemuneration).times(fullMonthsWorkedInCessationYear).div(12),
  );
  const unusedPriorYearHolidayPay = round2(dailyRate.times(input.unusedPriorYearHolidayDays ?? 0));

  return {
    fullMonthsWorkedInCessationYear,
    proportionalHolidayDays,
    proportionalHolidayPay,
    proportionalChristmasSubsidy,
    unusedPriorYearHolidayPay,
    total: round2(
      d(proportionalHolidayPay).plus(proportionalChristmasSubsidy).plus(unusedPriorYearHolidayPay),
    ),
  };
}
