import { getMeta, getIrsBracketsRuleSet, getSsIndependentRuleSet, getCatBRuleSet, getVatRuleSet } from "../rules/loader";
import type { Profile, FreelanceInput, FreelanceResult } from "./types";
import { calculateAnnualIrs } from "./annual-irs";
import { calculateTaxableB } from "./regime-simplificado";
import { d, round2 } from "./money";

/** Converts whatever billing shape the user entered into a flat monthly
 *  invoiced average (spec §4.1). Day-rate's annual day count has no
 *  confirmed default yet (spec §12 flags this as still open for Paulo) —
 *  220 working days/year is used as a documented placeholder assumption
 *  (roughly 11 months worked, holidays/bench time already netted out),
 *  not a verified figure. */
function monthlyInvoiced(billing: FreelanceInput["billing"]): number {
  if (billing.mode === "monthly") return billing.amount;
  if (billing.mode === "annual") return billing.amount / 12;
  const daysPerYear = billing.daysPerYear ?? 220;
  return (billing.amount * daysPerYear) / 12;
}

/** Mode B: recibos verdes (spec §4). Pure function, same architecture as
 *  Mode A — no I/O, everything from `/rules` via the loader. */
export function calculateFreelanceNet(profile: Profile, input: FreelanceInput): FreelanceResult {
  const meta = getMeta(profile.year);
  const ssRules = getSsIndependentRuleSet(profile.year, profile.month);
  const catB = getCatBRuleSet(profile.year, profile.month);
  const vat = getVatRuleSet(profile.year, profile.month);
  const flags: string[] = [];

  const invoiced = round2(d(monthlyInvoiced(input.billing)));

  // 3.3/4.2: Social Security.
  let ss = 0;
  if (input.monthsSinceStart < ssRules.exemptFirstMonths) {
    flags.push("SS_EXEMPT_FIRST_12_MONTHS");
  } else {
    const relevantIncome = d(invoiced).times(ssRules.relevantIncomePct.services);
    const acumulacaoThreshold = d(meta.ias).times(ssRules.acumulacaoExemption.thresholdMultipleOfIas);
    if (input.alsoEmployed && relevantIncome.lessThan(acumulacaoThreshold)) {
      flags.push("SS_EXEMPT_ACUMULACAO");
    } else if (relevantIncome.greaterThan(0)) {
      const adjustmentPct = Math.max(
        ssRules.baseAdjustment.minPct,
        Math.min(ssRules.baseAdjustment.maxPct, input.baseAdjustmentPct ?? 0),
      );
      const adjustedBase = relevantIncome.times(1 + adjustmentPct);
      const maxBase = d(meta.ias).times(ssRules.maximumMonthlyBase.multipleOfIas);
      const atCeiling = adjustedBase.greaterThan(maxBase);
      const cappedBase = atCeiling ? maxBase : adjustedBase;
      if (atCeiling) flags.push("SS_MAXIMUM_BASE_APPLIED");
      ss = round2(Math.max(cappedBase.times(ssRules.rate).toNumber(), ssRules.minimumMonthlyContribution));
    }
  }

  // 4.3: IRS withholding on this recibo.
  const expectedAnnualInvoiced = round2(d(invoiced).times(12));
  let irsWithheld = 0;
  if (input.clientLocation !== "pt") {
    flags.push("NO_WITHHOLDING_FOREIGN_CLIENT");
    if (input.clientLocation === "eu") flags.push("REVERSE_CHARGE_EU");
  } else if (profile.flatRate20) {
    irsWithheld = round2(d(invoiced).times(catB.ificiRate));
    flags.push("IFICI_FLAT_WITHHOLDING");
  } else if (input.withholdingWaiver && expectedAnnualInvoiced <= catB.dispensaThresholdAnnual) {
    flags.push("WITHHOLDING_WAIVER_APPLIED");
  } else {
    const rate = input.activityType === "art151" ? catB.withholdingRates.art151 : catB.withholdingRates.otherServices;
    irsWithheld = round2(d(invoiced).times(rate));
  }

  // 4.4: IVA — pass-through, never enters net income.
  let vatOnInvoice = 0;
  if (input.vatRegime === "art53_exempt") {
    flags.push("ART53_VAT_EXEMPT");
    if (expectedAnnualInvoiced > vat.exemptionLossThresholdAnnual) flags.push("ART53_THRESHOLD_LIKELY_EXCEEDED");
  } else if (input.clientLocation === "pt") {
    vatOnInvoice = round2(d(invoiced).times(vat.rates[profile.region]));
  } else if (input.clientLocation === "eu") {
    flags.push("REVERSE_CHARGE_EU");
  } else {
    flags.push("OUTSIDE_SCOPE_NON_EU_VAT");
  }

  // 4.5: Annual IRS, regime simplificado.
  const invoicedAnnual = expectedAnnualInvoiced;
  const taxableBValue = calculateTaxableB(
    {
      invoicedAnnual,
      activityType: input.activityType,
      yearOfActivity: input.yearOfActivity,
      alsoEmployed: input.alsoEmployed,
      declaredExpenses: input.declaredExpenses,
      ssPaidAnnual: round2(d(ss).times(12)),
    },
    catB,
  );
  const taxableB = d(taxableBValue);

  let catANet = d(0);
  if (input.alsoEmployed && input.employmentGrossMonthly) {
    // Assumes 14 payments/year — the simplest standard case; Mode B's
    // input has no paymentsPerYear field of its own for the "also
    // employed" side-job.
    const catAGross = d(input.employmentGrossMonthly).times(14);
    const catAEmployeeSs = catAGross.times(0.11);
    const floor = catAEmployeeSs.greaterThan(4587.09) ? catAEmployeeSs : d(4587.09);
    const net = catAGross.minus(floor);
    catANet = net.greaterThan(0) ? net : d(0);
  }

  const rendimentoColetavel = round2(taxableB.plus(catANet));
  const annualIrsWithheld = round2(d(irsWithheld).times(12));

  let irsLiability: number;
  if (profile.flatRate20) {
    irsLiability = round2(taxableB.times(catB.ificiRate));
  } else if (profile.region === "continente") {
    const irsBrackets = getIrsBracketsRuleSet("continente", profile.year, profile.month);
    const annualResult = calculateAnnualIrs({
      rendimentoColetavel,
      grossAnnualIncome: round2(d(invoicedAnnual).plus(catANet.greaterThan(0) ? d(input.employmentGrossMonthly ?? 0).times(14) : 0)),
      ias: meta.ias,
      withheld: annualIrsWithheld,
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
    irsLiability = annualResult.irsLiquidado;
  } else {
    // Madeira/Açores annual IRS brackets aren't transcribed yet (same gap
    // as Mode A) — falls back to what's actually being withheld rather
    // than guessing a liability figure.
    irsLiability = annualIrsWithheld;
    flags.push("ANNUAL_IRS_UNAVAILABLE_REGION");
  }

  const recommendedMonthlyTaxReserve = round2(d(irsLiability).dividedBy(12));
  const annualSs = round2(d(ss).times(12));

  const cashInHand = round2(d(invoiced).minus(ss).minus(irsWithheld));
  const trueNet = round2(d(invoiced).minus(ss).minus(recommendedMonthlyTaxReserve));

  return {
    monthly: { invoiced, vatOnInvoice, irsWithheld, ss, cashInHand, trueNet },
    annual: {
      invoiced: invoicedAnnual,
      ss: annualSs,
      irsWithheld: annualIrsWithheld,
      irsLiability,
      trueNet: round2(d(invoicedAnnual).minus(annualSs).minus(irsLiability)),
    },
    recommendedMonthlyTaxReserve,
    flags,
  };
}
