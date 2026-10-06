import Decimal from "decimal.js";
import type { Meta } from "../rules/schema";
import type { MealInput, MealAllowanceSplit } from "./types";
import { d, round2 } from "./money";

/** Meal allowance exempt/taxable split (spec §3.4). Paid per day worked,
 *  never on subsidies — the caller must not add this to a holiday/
 *  Christmas subsidy month. Excess above the exempt limit is taxable for
 *  IRS *and* subject to Social Security. */
export function splitMealAllowance(meal: MealInput, meta: Meta): MealAllowanceSplit {
  if (meal.type === "none" || meal.dailyValue <= 0 || meal.daysPerMonth <= 0) {
    return { taxableDaily: 0, exemptDaily: 0, taxableMonthly: 0, exemptMonthly: 0 };
  }

  const exemptLimit = meal.type === "cash" ? meta.mealAllowance.cashExemptDaily : meta.mealAllowance.cardExemptDaily;
  // Daily figures are kept as exact Decimals, not rounded (spec T5:
  // "taxable €0.545/day BEFORE rounding") — only the monthly totals get
  // rounded to cents. Plain `11 - 10.455` in JS floating point gives
  // 0.5449999999999999, not 0.545 — exactly the class of bug spec §0
  // rule #4 exists to prevent; Decimal avoids it.
  const exemptDailyD = Decimal.min(d(meal.dailyValue), d(exemptLimit));
  const taxableDailyD = Decimal.max(d(0), d(meal.dailyValue).minus(exemptLimit));

  return {
    taxableDaily: taxableDailyD.toNumber(),
    exemptDaily: exemptDailyD.toNumber(),
    taxableMonthly: round2(taxableDailyD.times(meal.daysPerMonth)),
    exemptMonthly: round2(exemptDailyD.times(meal.daysPerMonth)),
  };
}
