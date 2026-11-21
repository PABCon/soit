import { getFixedTermRuleSet } from "../rules/loader";
import { calculateSeniority } from "./seniority";
import { d, round2 } from "./money";
import type { TerminationProfile, FixedTermCompensationResult } from "./types";

/** CT art. 344.º, n.º 1: compensation owed when a contrato a termo
 *  certo reaches its term by caducidade (employer's declaration or by
 *  operation of law). Only applies when the EMPLOYER/natural expiry
 *  ends the contract, never when the employee is the one who ends it
 *  (that's resignation.ts's art. 400.º notice instead). No salary-base
 *  or total cap exists for this one in the source text found, unlike
 *  art. 366.º's severance, which does. */
export function calculateFixedTermCompensation(profile: TerminationProfile): FixedTermCompensationResult {
  const seniority = calculateSeniority(profile.contractStartDate, profile.cessationDate);
  const rules = getFixedTermRuleSet(profile.cessationDate);

  if (seniority.isPreOct2013) {
    return {
      preOct2013NotSupported: true,
      yearsOfService: seniority.yearsDecimal,
      dayRatePerYear: rules.dayRatePerYear,
      amount: 0,
    };
  }

  const dailyRate = d(profile.monthlyRemuneration).div(30);
  const amount = round2(dailyRate.times(rules.dayRatePerYear).times(seniority.yearsDecimal));

  return {
    preOct2013NotSupported: false,
    yearsOfService: seniority.yearsDecimal,
    dayRatePerYear: rules.dayRatePerYear,
    amount,
  };
}
