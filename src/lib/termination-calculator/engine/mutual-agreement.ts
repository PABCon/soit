import { calculateSeverance } from "./severance";
import { calculateSeniority } from "./seniority";
import { calculateSeveranceTaxExemption } from "./tax-exemption";
import type { MutualAgreementInput, MutualAgreementResult } from "./types";

/** CT art. 349.º/350.º: a mútuo acordo has NO statutory severance
 *  formula at all. It's purely negotiated, must be in writing, and
 *  carries a 7-day revocation right (repaying any compensation already
 *  received). There is no legal "fair offer" floor to compare against.
 *
 *  The one honest, defensible comparison: what CT art. 366.º would pay
 *  for an equivalent dismissal without cause. This function frames the
 *  offered amount as a percentage of that benchmark, explicitly never
 *  as "you're legally owed at least X," since that claim would be
 *  false for this termination type. */
export function calculateMutualAgreementComparison(input: MutualAgreementInput): MutualAgreementResult {
  const benchmarkSeverance = calculateSeverance(input.profile);

  if (benchmarkSeverance.preOct2013NotSupported) {
    const cessationYear = new Date(`${input.profile.cessationDate}T00:00:00Z`).getUTCFullYear();
    return {
      preOct2013NotSupported: true,
      benchmarkSeverance,
      offeredAmount: input.offeredAmount,
      offeredAsPercentOfBenchmark: null,
      taxExemption: calculateSeveranceTaxExemption(0, 0, 0, cessationYear),
    };
  }

  const offeredAsPercentOfBenchmark =
    benchmarkSeverance.amount > 0
      ? Math.round((input.offeredAmount / benchmarkSeverance.amount) * 1000) / 10
      : null;

  const seniority = calculateSeniority(input.profile.contractStartDate, input.profile.cessationDate);
  const cessationYear = new Date(`${input.profile.cessationDate}T00:00:00Z`).getUTCFullYear();
  // Uses the candidate's current monthly remuneration as a stand-in for
  // "average monthly compensation-character remuneration over the last
  // 12 months," a reasonable simplification for someone with stable
  // pay; a documented approximation, not the literal 12-month average
  // the statute describes, same spirit as other reasonable, flagged
  // simplifications already in this project's salary calculator.
  const taxExemption = calculateSeveranceTaxExemption(
    input.offeredAmount,
    input.profile.monthlyRemuneration,
    seniority.yearsDecimal,
    cessationYear,
  );

  return {
    preOct2013NotSupported: false,
    benchmarkSeverance,
    offeredAmount: input.offeredAmount,
    offeredAsPercentOfBenchmark,
    taxExemption,
  };
}
