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
 *  and is withheld "autonomously": confirmed directly against a real
 *  primary source (fisco.pt's own guide, quoting the rule): "um
 *  subsídio igual ao teu salário base leva a mesma retenção que um mês
 *  normal" — a subsidy equal to the base salary gets the exact SAME
 *  retention a regular month would, meaning the full R×rate−parcela−
 *  dependentDeduction formula, not a bare marginal rate with no
 *  abatement at all (a real bug this fixes, caught by the user
 *  comparing against an external calculator — the flat-rate version
 *  overcharged IRS on every subsidy/duodécimo by exactly the parcela +
 *  dependent-deduction amount that should have applied). `fraction`
 *  covers the duodécimo-spread case too, same source: "cada duodécimo
 *  de um subsídio retém 1/12" of that subsidy's own full retention —
 *  a proportional SHARE of the full-subsidy figure, never a fresh
 *  bracket lookup on the smaller sliced amount. */
function calculateSubsidyMonth(
  fraction: number,
  fullSubsidyRetention: number,
  grossMonthly: number,
  meta: ReturnType<typeof getMeta>,
): SubsidyMonth {
  const subsidyGross = round2(d(grossMonthly).times(fraction));
  const ss = calculateEmployeeSocialSecurity(subsidyGross, meta);
  const irs = round2(d(fullSubsidyRetention).times(fraction));
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
  const exemptAllowance = input.exemptAllowanceMonthly ?? 0;
  const irsApplicableAllowance = input.irsApplicableAllowanceMonthly ?? 0;

  // §3.2: R = base + taxable part of meal allowance + other taxable.
  // The IRS-applicable allowance widens the IRS base only — it's
  // explicitly carved out of the SS base, on both sides. The exempt
  // allowance never enters either base — fully exempt, pass-through.
  const irsBase = round2(
    d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other).plus(irsApplicableAllowance),
  );
  const ssBase = round2(d(input.grossMonthly).plus(mealSplit.taxableMonthly).plus(other));
  const withholding = calculateMonthlyWithholding(profile, irsBase);

  const baseSs = calculateEmployeeSocialSecurity(ssBase, meta);
  const baseIrs = withholding.retention;

  // Subsidies (férias/Natal) and duodécimos (spec §3.2, §3.1). Each
  // subsidy's own full retention is computed once, on its own gross
  // (= one month's base salary, no meal allowance — spec §3.4), through
  // the exact same bracket/parcela/dependent-deduction formula a
  // regular month uses — confirmed directly against a primary source
  // (see calculateSubsidyMonth's own doc comment). Every other figure
  // below (a lump-sum subsidy month, a duodécimo spread, a half-
  // spread's remaining lump sum) is just a proportional fraction of
  // that one number, never a fresh, independent bracket lookup on a
  // smaller sliced amount.
  const fullSubsidyRetention = calculateMonthlyWithholding(profile, input.grossMonthly).retention;

  let subsidyMonths: EmploymentResult["subsidyMonths"] = null;
  let duodecimoGross = 0;
  let duodecimoSs = 0;
  let duodecimoIrs = 0;

  if (input.paymentsPerYear === 14) {
    if (input.twelfths === "none") {
      const holiday = calculateSubsidyMonth(1, fullSubsidyRetention, input.grossMonthly, meta);
      const christmas = calculateSubsidyMonth(1, fullSubsidyRetention, input.grossMonthly, meta);
      subsidyMonths = { holiday, christmas };
    } else {
      // 'half': 50% of each subsidy spread monthly, the other 50% still
      // paid as its own subsidy month. 'full': both subsidies spread
      // entirely, no separate subsidy month at all.
      const spreadFraction = input.twelfths === "full" ? 1 : 0.5;
      duodecimoGross = round2(d(input.grossMonthly).times(2).times(spreadFraction).dividedBy(12));
      duodecimoSs = calculateEmployeeSocialSecurity(duodecimoGross, meta);
      duodecimoIrs = round2(d(fullSubsidyRetention).times(2).times(spreadFraction).dividedBy(12));

      if (spreadFraction < 1) {
        const holiday = calculateSubsidyMonth(1 - spreadFraction, fullSubsidyRetention, input.grossMonthly, meta);
        const christmas = calculateSubsidyMonth(1 - spreadFraction, fullSubsidyRetention, input.grossMonthly, meta);
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
      .plus(irsApplicableAllowance)
      .plus(exemptAllowance)
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
    exemptAllowance,
    irsApplicableAllowance,
    ss,
    irs,
    net,
    netIncludingMeal,
    irsBase,
    ssBase,
    irsRate: withholding.rate,
    irsTableUsed: withholding.tableUsed,
    irsParcela: withholding.parcela,
    irsDependentDeduction: withholding.dependentDeduction,
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
  const annualExemptAllowance = d(exemptAllowance).times(12);
  const annualIrsApplicableAllowance = d(irsApplicableAllowance).times(12);
  const annualNet = annualGross
    .minus(annualSs)
    .minus(annualIrsWithheld)
    .plus(annualIrsApplicableAllowance)
    .plus(annualExemptAllowance);
  const annualNetIncludingMeal = annualNet.plus(annualMealExempt);

  // Employer SS (23.75%) applies to the same base as the employee's own
  // 11% — the regular month (incl. any duodécimo share) and each subsidy
  // month — not just the regular month alone. The IRS-applicable
  // allowance stays out of this base on the employer side too, same
  // carve-out as the employee's.
  const employerSsMonthly = calculateEmployerSocialSecurity(round2(d(ssBase).plus(duodecimoGross)), meta);
  let employerCostAnnual = d(input.grossMonthly)
    .plus(duodecimoGross)
    .plus(employerSsMonthly)
    .plus(irsApplicableAllowance)
    .plus(exemptAllowance)
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
