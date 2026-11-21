import Decimal from "decimal.js";
import { getTerminationMeta } from "../rules/loader";
import { d, round2 } from "./money";
import type { TaxExemptionResult } from "./types";

/** CIRS art. 2.º, n.º 4, al. b): compensation paid on contract
 *  cessation (dismissal under art. 366.º, or a mútuo acordo payment
 *  alike) is exempt from IRS up to the lower of: the average monthly
 *  value of regular/compensation-character remuneration over the last
 *  12 months × years (or fraction) of seniority, or an absolute cap of
 *  240× RMMG. The amount above that is taxed as ordinary Categoria A
 *  employment income. This is explicitly framed to the candidate as an
 *  estimate, not tax advice, the same non-advisory boundary the salary
 *  calculator already draws. */
export function calculateSeveranceTaxExemption(
  compensationAmount: number,
  avgMonthlyCompensationLast12Months: number,
  yearsOfSeniority: number,
  cessationYear: number,
): TaxExemptionResult {
  const meta = getTerminationMeta(cessationYear);

  const exemptionCapFormula = round2(d(avgMonthlyCompensationLast12Months).times(yearsOfSeniority));
  const exemptionCapAbsolute = round2(d(meta.rmmg).times(meta.taxExemptionCapMultiplierOfRmmg));
  const effectiveCap = Decimal.min(d(exemptionCapFormula), d(exemptionCapAbsolute));

  const exemptAmount = round2(Decimal.min(d(compensationAmount), effectiveCap));
  const taxableAmount = round2(d(compensationAmount).minus(exemptAmount));

  return { exemptionCapFormula, exemptionCapAbsolute, exemptAmount, taxableAmount };
}
