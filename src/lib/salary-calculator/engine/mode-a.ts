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
  const expenseAllowance = input.expenseAllowanceMonthly ?? 0;
  const fringeBenefits = input.fringeBenefitsMonthly ?? 0;

  // §3.2: R = base + taxable part of meal allowance + other taxable.
  // Fringe benefits (e.g. Coverflex-style) widen the IRS base only —
  // they're explicitly carved out of the SS base, on both sides.
  // Ajudas de custo never enter either base — fully exempt, pass-through.
  const irsBase = round2(d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other).plus(fringeBenefits));
  const ssBase = round2(d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other));
  const withholding = calculateMonthlyWithholding(profile, irsBase);

  const baseSs = calculateEmployeeSocialSecurity(ssBase, meta);
  const baseIrs = withholding.retention;

  // Subsidies (férias/Natal) and duodécimos (spec §3.2, §3.1). Confirmed
  // live against the real mechanism (OCC guidance on IRS retenção na
  // fonte for subsídios): a spread duodécimo fraction is withheld
  // "autonomously" at the rate corresponding to the *subsidy's own full
  // value* (same bracket the regular month's R already falls into, since
  // a subsidy equals one month's gross by definition) — not merged into
  // R, no parcela/dependent abatement — same convention as a full
  // subsidy month, just paid out as a smaller amount every month instead
  // of a lump sum in June/December. This actually changes the money the
  // employee receives *every month* when duodécimos are on, not just the
  // annual total — a real bug (caught by the user, not by any of this
  // session's tests) in an earlier version of this function left it only
  // affecting the annual totals.
  let subsidyMonths: EmploymentResult["subsidyMonths"] = null;
  let duodecimoGross = 0;
  let duodecimoSs = 0;
  let duodecimoIrs = 0;

  if (input.paymentsPerYear === 14) {
    if (input.twelfths === "none") {
      const holiday = calculateSubsidyMonth(input.grossMonthly, withholding.rate, meta);
      const christmas = calculateSubsidyMonth(input.grossMonthly, withholding.rate, meta);
      subsidyMonths = { holiday, christmas };
    } else {
      // 'half': 50% of each subsidy spread monthly, the other 50% still
      // paid as its own subsidy month. 'full': both subsidies spread
      // entirely, no separate subsidy month at all.
      const spreadFraction = input.twelfths === "full" ? 1 : 0.5;
      duodecimoGross = round2(d(input.grossMonthly).times(2).times(spreadFraction).dividedBy(12));
      duodecimoSs = calculateEmployeeSocialSecurity(duodecimoGross, meta);
      duodecimoIrs = round2(d(duodecimoGross).times(withholding.rate));

      if (spreadFraction < 1) {
        const remainderPerSubsidy = round2(d(input.grossMonthly).times(1 - spreadFraction));
        const holiday = calculateSubsidyMonth(remainderPerSubsidy, withholding.rate, meta);
        const christmas = calculateSubsidyMonth(remainderPerSubsidy, withholding.rate, meta);
        subsidyMonths = { holiday, christmas };
      }
    }
  }

  const ss = round2(d(baseSs).plus(duodecimoSs));
  const irs = round2(d(baseIrs).plus(duodecimoIrs));
  const net = round2(
    d(input.grossMonthly)
      .plus(duodecimoGross)
      .plus(mealSplit.taxableMonthly)
      .plus(other)
      .plus(fringeBenefits)
      .plus(expenseAllowance)
      .minus(ss)
      .minus(irs),
  );
  const netIncludingMeal = round2(d(net).plus(mealSplit.exemptMonthly));
  // net already folds in taxableMonthly (it's part of irsBase/ssBase
  // above); only the exempt portion still needs adding to reach the
  // employee's real total cash-in-hand including the full meal benefit.

  const monthly = {
    gross: input.grossMonthly,
    duodecimoGross,
    taxableMeal: mealSplit.taxableMonthly,
    exemptMeal: mealSplit.exemptMonthly,
    expenseAllowance,
    fringeBenefits,
    ss,
    irs,
    net,
    netIncludingMeal,
  };

  let annualGross = d(input.grossMonthly).plus(duodecimoGross).times(12);
  let annualSs = d(ss).times(12);
  let annualIrsWithheld = d(irs).times(12);

  if (subsidyMonths) {
    annualGross = annualGross.plus(subsidyMonths.holiday.gross).plus(subsidyMonths.christmas.gross);
    annualSs = annualSs.plus(subsidyMonths.holiday.ss).plus(subsidyMonths.christmas.ss);
    annualIrsWithheld = annualIrsWithheld.plus(subsidyMonths.holiday.irs).plus(subsidyMonths.christmas.irs);
  }

  const annualMealExempt = d(mealSplit.exemptMonthly).times(12);
  // The employer pays the *full* meal allowance, exempt and taxable
  // portions alike — only the employee's own tax treatment differs by
  // portion, the employer's real cash cost doesn't.
  const annualMealTotal = d(mealSplit.exemptMonthly).plus(mealSplit.taxableMonthly).times(12);
  const annualExpenseAllowance = d(expenseAllowance).times(12);
  const annualFringeBenefits = d(fringeBenefits).times(12);
  const annualNet = annualGross
    .minus(annualSs)
    .minus(annualIrsWithheld)
    .plus(annualFringeBenefits)
    .plus(annualExpenseAllowance);
  const annualNetIncludingMeal = annualNet.plus(annualMealExempt);

  // Employer SS (23.75%) applies to the same base as the employee's own
  // 11% — the regular month (incl. any duodécimo share) and each subsidy
  // month — not just the regular month alone. Fringe benefits stay out of
  // this base on the employer side too, same carve-out as the employee's.
  const employerSsMonthly = calculateEmployerSocialSecurity(round2(d(ssBase).plus(duodecimoGross)), meta);
  let employerCostAnnual = d(input.grossMonthly)
    .plus(duodecimoGross)
    .plus(employerSsMonthly)
    .plus(fringeBenefits)
    .plus(expenseAllowance)
    .times(12);
  if (subsidyMonths) {
    const holidayEmployerSs = calculateEmployerSocialSecurity(subsidyMonths.holiday.gross, meta);
    const christmasEmployerSs = calculateEmployerSocialSecurity(subsidyMonths.christmas.gross, meta);
    employerCostAnnual = employerCostAnnual
      .plus(subsidyMonths.holiday.gross)
      .plus(holidayEmployerSs)
      .plus(subsidyMonths.christmas.gross)
      .plus(christmasEmployerSs);
  }
  employerCostAnnual = employerCostAnnual.plus(annualMealTotal);

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
      grossAnnualIncome: round2(annualGross),
      ias: meta.ias,
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
