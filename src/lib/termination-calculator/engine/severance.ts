import Decimal from "decimal.js";
import { getSeveranceRuleSet, getTerminationMeta } from "../rules/loader";
import { calculateSeniority } from "./seniority";
import { d, round2 } from "./money";
import type { TerminationProfile, SeveranceResult } from "./types";

/** CT art. 366.º: the one formula behind dismissal without cause,
 *  extinção do posto de trabalho (art. 372.º), despedimento coletivo,
 *  and despedimento por inadaptação (art. 379.º). All four cross-
 *  reference this same article, so one function covers all of them.
 *
 *  Also the benchmark mutual-agreement.ts compares a negotiated offer
 *  against, never a legal entitlement for mútuo acordo itself, just
 *  "what you'd get if this were a dismissal instead."
 *
 *  The law states the total cap as two clauses ("12× monthly
 *  remuneration, or, where the per-month salary-base cap applies,
 *  240× RMMG"), but once the salary base itself is capped at 20× RMMG,
 *  12 × (20 × RMMG) = 240 × RMMG algebraically. The two clauses are the
 *  same number whenever the base cap actually bites, and reduce to a
 *  single `min(rawAmount, 12 × cappedMonthlyBase)` either way. */
export function calculateSeverance(profile: TerminationProfile): SeveranceResult {
  const seniority = calculateSeniority(profile.contractStartDate, profile.cessationDate);
  const rules = getSeveranceRuleSet(profile.cessationDate);

  if (seniority.isPreOct2013) {
    return {
      preOct2013NotSupported: true,
      yearsOfService: seniority.yearsDecimal,
      cappedMonthlyBase: 0,
      dayRatePerYear: rules.dayRatePerYear,
      rawAmount: 0,
      totalCap: 0,
      wasCapped: false,
      amount: 0,
    };
  }

  const cessationYear = new Date(`${profile.cessationDate}T00:00:00Z`).getUTCFullYear();
  const meta = getTerminationMeta(cessationYear);

  const salaryBaseCap = d(meta.rmmg).times(rules.salaryBaseCapMultiplierOfRmmg);
  const cappedMonthlyBase = round2(Decimal.min(d(profile.monthlyRemuneration), salaryBaseCap));

  const dailyRate = d(cappedMonthlyBase).div(30);
  const rawAmount = round2(dailyRate.times(rules.dayRatePerYear).times(seniority.yearsDecimal));

  const totalCap = round2(d(cappedMonthlyBase).times(rules.totalCapMultiplierOfMonths));
  const amount = Math.min(rawAmount, totalCap);

  return {
    preOct2013NotSupported: false,
    yearsOfService: seniority.yearsDecimal,
    cappedMonthlyBase,
    dayRatePerYear: rules.dayRatePerYear,
    rawAmount,
    totalCap,
    wasCapped: amount < rawAmount,
    amount,
  };
}
