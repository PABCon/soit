import Decimal from "decimal.js";
import { getMeta, getIrsBracketsRuleSet } from "../rules/loader";
import type { Profile, EmploymentInput, EmploymentResult, SubsidyMonth } from "./types";
import { calculateMonthlyWithholding } from "./withholding";
import { splitMealAllowance } from "./meal-allowance";
import { calculateEmployeeSocialSecurity, calculateEmployerSocialSecurity } from "./social-security";
import { calculateAnnualIrs } from "./annual-irs";
import { d, round2 } from "./money";

/** A subsidy month (férias/Natal) carries no meal allowance — "meal
 *  allowance is paid per day worked, never on subsidies" (spec §3.4) —
 *  and is withheld "autonomously": the SAME marginal rate the regular
 *  month's R falls into, applied directly to the subsidy gross with no
 *  parcela or per-dependent abatement (spec §3.2). */
function calculateSubsidyMonth(subsidyGross: number, rate: number, meta: ReturnType<typeof getMeta>): SubsidyMonth {
  const ss = calculateEmployeeSocialSecurity(subsidyGross, meta);
  const irs = round2(d(subsidyGross).times(rate));
  return {
    gross: subsidyGross,
    ss,
    irs,
    net: round2(d(subsidyGross).minus(ss).minus(irs)),
  };
}

/** Mode A: contrato de trabalho (spec §3). Pure function — no I/O, no
 *  framework dependency, everything it needs comes from `/rules` via the
 *  loader. */
export function calculateEmploymentNet(profile: Profile, input: EmploymentInput): EmploymentResult {
  const meta = getMeta(profile.year);

  const mealSplit = splitMealAllowance(input.meal, meta);
  const other = input.otherTaxableMonthly ?? 0;

  // §3.2: R = base + taxable part of meal allowance + other taxable.
  const taxableRemuneration = round2(d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other));
  const withholding = calculateMonthlyWithholding(profile, taxableRemuneration);

  const ss = calculateEmployeeSocialSecurity(taxableRemuneration, meta);
  const irs = withholding.retention;
  const net = round2(d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other).minus(ss).minus(irs));
  const netIncludingMeal = round2(d(net).plus(mealSplit.exemptMonthly));
  // net already folds in taxableMonthly (it's part of taxableRemuneration
  // above); only the exempt portion still needs adding to reach the
  // employee's real total cash-in-hand including the full meal benefit.

  const monthly = {
    gross: input.grossMonthly,
    taxableMeal: mealSplit.taxableMonthly,
    exemptMeal: mealSplit.exemptMonthly,
    ss,
    irs,
    net,
    netIncludingMeal,
  };

  // Subsidies (férias/Natal) and duodécimos (spec §3.2, §3.1). Only the
  // common, unambiguous case — 14 payments, no duodécimos — is modeled
  // precisely; partial/full duodécimos spreading is a real spec VERIFY
  // item ("VERIFY exact rule in the despacho text") and isn't exercised
  // by any Phase-1 test, so it's handled as a documented simplification:
  // the spread portion is folded into the regular month's gross instead
  // of modeling a separate monthly-fraction withholding rate.
  let subsidyMonths: EmploymentResult["subsidyMonths"] = null;
  let annualGross = d(input.grossMonthly).times(12);
  let annualSs = d(ss).times(12);
  let annualIrsWithheld = d(irs).times(12);

  if (input.paymentsPerYear === 14) {
    if (input.twelfths === "none") {
      const holiday = calculateSubsidyMonth(input.grossMonthly, withholding.rate, meta);
      const christmas = calculateSubsidyMonth(input.grossMonthly, withholding.rate, meta);
      subsidyMonths = { holiday, christmas };
      annualGross = annualGross.plus(holiday.gross).plus(christmas.gross);
      annualSs = annualSs.plus(holiday.ss).plus(christmas.ss);
      annualIrsWithheld = annualIrsWithheld.plus(holiday.irs).plus(christmas.irs);
    } else {
      // 'half' spreads 50% of each subsidy monthly, the other 50% still
      // paid in its own month; 'full' spreads both entirely. Simplified
      // here to: the spread share is added to the annual totals directly
      // (as if evenly withheld across the year at the regular rate),
      // without re-deriving a separate monthly R — see comment above.
      const spreadFraction = input.twelfths === "full" ? 1 : 0.5;
      const spreadAnnual = d(input.grossMonthly).times(2).times(spreadFraction);
      const remainderPerSubsidy = d(input.grossMonthly).times(1 - spreadFraction);

      annualGross = annualGross.plus(spreadAnnual).plus(remainderPerSubsidy.times(2));
      const spreadSs = calculateEmployeeSocialSecurity(spreadAnnual.toNumber(), meta);
      const spreadIrs = round2(spreadAnnual.times(withholding.rate));
      annualSs = annualSs.plus(spreadSs);
      annualIrsWithheld = annualIrsWithheld.plus(spreadIrs);

      if (remainderPerSubsidy.greaterThan(0)) {
        const holiday = calculateSubsidyMonth(remainderPerSubsidy.toNumber(), withholding.rate, meta);
        const christmas = calculateSubsidyMonth(remainderPerSubsidy.toNumber(), withholding.rate, meta);
        subsidyMonths = { holiday, christmas };
        annualSs = annualSs.plus(holiday.ss).plus(christmas.ss);
        annualIrsWithheld = annualIrsWithheld.plus(holiday.irs).plus(christmas.irs);
      }
    }
  }

  const annualMealExempt = d(mealSplit.exemptMonthly).times(12);
  const annualNet = annualGross.minus(annualSs).minus(annualIrsWithheld);
  const annualNetIncludingMeal = annualNet.plus(annualMealExempt);

  const employerSsMonthly = calculateEmployerSocialSecurity(taxableRemuneration, meta);
  const employerCostAnnual = annualGross.plus(d(employerSsMonthly).times(12)).plus(annualMealExempt);

  const result: EmploymentResult = {
    monthly,
    subsidyMonths,
    annual: {
      gross: round2(annualGross),
      ss: round2(annualSs),
      irsWithheld: round2(annualIrsWithheld),
      net: round2(annualNet),
      netIncludingMeal: round2(annualNetIncludingMeal),
    },
    employerCost: {
      annual: round2(employerCostAnnual),
      monthlyEquivalent: round2(employerCostAnnual.dividedBy(12)),
    },
  };

  if (profile.region === "continente") {
    const irsBrackets = getIrsBracketsRuleSet(profile.region, profile.year, profile.month);
    const catANet = Math.max(0, round2(annualGross.minus(Decimal.max(4587.09, annualSs))));
    result.annualSettlementEstimate = calculateAnnualIrs({
      rendimentoColetavel: catANet,
      withheld: round2(annualIrsWithheld),
      irsBrackets,
      deductionInput: {
        dependents: profile.dependents,
        dependentsUnder3: profile.dependentsUnder3,
        dependentsWithDisability: profile.dependentsWithDisability,
        disabilityAbove60: profile.disabilityAbove60,
        maritalStatus: profile.maritalStatus,
      },
      includeDeductions: true,
    });
  }

  return result;
}
