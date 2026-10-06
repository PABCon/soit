import type { CatBRuleSet } from "../rules/schema";
import type { ActivityType } from "./types";
import { d, round2 } from "./money";

/** New-activity coefficient reduction (spec §4.5) — only applies absent
 *  Cat A/H income, which this engine approximates as "not also employed"
 *  (the real rule's other conditions, e.g. not a reopened activity closed
 *  < 5 years ago, aren't modeled — no input captures that case in v1). */
export function effectiveCoefficient(
  catB: CatBRuleSet,
  activityType: ActivityType,
  yearOfActivity: 1 | 2 | 3,
  alsoEmployed: boolean,
): number {
  const base = activityType === "art151" ? catB.coefficients.art151 : catB.coefficients.otherServices;
  if (alsoEmployed) return base;
  if (yearOfActivity === 1) return base * (1 - catB.newActivityReduction.year1);
  if (yearOfActivity === 2) return base * (1 - catB.newActivityReduction.year2);
  return base;
}

/** Regime simplificado (Cat B, spec §4.5): taxableB = invoicedAnnual ×
 *  coefficient, bumped up by the 15%-justification-rule shortfall when
 *  declared expenses + the SS-contributions-paid portion above 10% of
 *  gross don't clear 15% of gross. Confirmed against the spec's own PwC
 *  check case: €40,000 gross art151, €1,412.91 expenses → taxable
 *  €30,000 (justified = max(4587.09, ssExcess) + 1412.91 = 6000.00
 *  exactly equals required = 15% × 40,000, so shortfall is 0). */
export function calculateTaxableB(
  input: {
    invoicedAnnual: number;
    activityType: ActivityType;
    yearOfActivity: 1 | 2 | 3;
    alsoEmployed: boolean;
    declaredExpenses: number;
    ssPaidAnnual: number;
  },
  catB: CatBRuleSet,
): number {
  const coefficient = effectiveCoefficient(catB, input.activityType, input.yearOfActivity, input.alsoEmployed);
  let taxableB = d(input.invoicedAnnual).times(coefficient);

  const required = d(input.invoicedAnnual).times(catB.justificationRule.requiredPct);
  const ssExcess = d(input.ssPaidAnnual).minus(
    d(input.invoicedAnnual).times(catB.justificationRule.ssExcessThresholdPct),
  );
  const ssExcessPositive = ssExcess.greaterThan(0) ? ssExcess : d(0);
  const justified = (
    ssExcessPositive.greaterThan(catB.justificationRule.fixedDeduction)
      ? ssExcessPositive
      : d(catB.justificationRule.fixedDeduction)
  ).plus(input.declaredExpenses);
  const shortfall = required.minus(justified);
  if (shortfall.greaterThan(0)) taxableB = taxableB.plus(shortfall);

  return round2(taxableB);
}
