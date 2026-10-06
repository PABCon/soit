import Decimal from "decimal.js";
import { getMeta, getIrcRuleSet } from "../rules/loader";
import type { Profile, CompanyInput, CompanyResult, EmploymentInput } from "./types";
import { calculateEmploymentNet } from "./mode-a";
import { d, round2 } from "./money";

/** Mode C: B2B via empresa própria (Sociedade Unipessoal Lda, spec §5).
 *  Pure function — the gerente's own salary is run straight through Mode
 *  A (Cat A withholding + 11% SS), exactly as the spec specifies; this
 *  function only adds the company-level P&L and dividend math on top. */
export function calculateCompanyNet(profile: Profile, input: CompanyInput): CompanyResult {
  const meta = getMeta(profile.year);
  const irc = getIrcRuleSet(profile.year, profile.month);

  const gerenteAnnualGross = d(input.gerenteGrossMonthly).times(input.gerentePaymentsPerYear);

  // Minimum SS base is 1×IAS/month (12×IAS/year) even if the gerente
  // draws no salary — confirmed via OCC guidance — UNLESS they're
  // self-declared exempt via coverage from another mandatory SS regime
  // (an unpaid gerente already covered elsewhere, earning > 1×IAS there).
  const minimumAnnualBase = d(meta.ias).times(12);
  const exemptViaOtherActivity = input.gerenteExemptViaOtherActivity === true && input.gerenteGrossMonthly === 0;
  const ssBase = exemptViaOtherActivity ? d(0) : Decimal.max(gerenteAnnualGross, minimumAnnualBase);
  const companySs = round2(ssBase.times(irc.gerenteSs.companyRate));
  const gerenteSs = round2(ssBase.times(irc.gerenteSs.memberRate));

  const accountantAnnual = d(input.accountantMonthly).times(12);
  const profitBeforeTax = d(input.revenueAnnual)
    .minus(input.operatingExpensesAnnual)
    .minus(accountantAnnual)
    .minus(gerenteAnnualGross)
    .minus(companySs);
  const taxableProfit = profitBeforeTax.greaterThan(0) ? profitBeforeTax : d(0);

  const ircAmount = input.isSME
    ? (taxableProfit.greaterThan(irc.sme.lowRateCeiling)
        ? d(irc.sme.lowRateCeiling)
            .times(irc.sme.lowRate)
            .plus(taxableProfit.minus(irc.sme.lowRateCeiling).times(irc.sme.highRate))
        : taxableProfit.times(irc.sme.lowRate))
    : taxableProfit.times(irc.nonSme.rate);

  const derrama = taxableProfit.times(input.municipalSurchargeRate);
  const netProfit = profitBeforeTax.minus(ircAmount).minus(derrama);
  // Legal reserve (art. 218.º CSC: 5% of profit until the reserve reaches
  // 20% of capital social, floor never below €2,500) is real but not
  // modeled — v1 has no "capital social" input, per the spec's explicit
  // allowance to skip it with a note rather than guess a company's
  // capital structure.
  const dividendsGross = input.distributeAllProfit && netProfit.greaterThan(0) ? netProfit : d(0);
  const dividendTax = dividendsGross.times(irc.dividendTaxRate);
  const dividendsNet = dividendsGross.minus(dividendTax);

  const employmentInput: EmploymentInput = {
    grossMonthly: input.gerenteGrossMonthly,
    paymentsPerYear: input.gerentePaymentsPerYear,
    twelfths: "none",
    meal: { type: "none", dailyValue: 0, daysPerMonth: 0 },
  };
  const gerenteSalary = calculateEmploymentNet(profile, employmentInput);
  const gerenteNetSalary = gerenteSalary.annual.net;

  const takeHomeAnnual = round2(d(gerenteNetSalary).plus(dividendsNet));
  const denominator = d(input.revenueAnnual).minus(input.operatingExpensesAnnual);
  const effectiveTaxRate = denominator.greaterThan(0)
    ? round2(d(input.revenueAnnual).minus(takeHomeAnnual).minus(input.operatingExpensesAnnual).dividedBy(denominator))
    : 0;

  return {
    company: {
      revenue: input.revenueAnnual,
      expenses: round2(d(input.operatingExpensesAnnual).plus(accountantAnnual)),
      gerenteCost: round2(gerenteAnnualGross.plus(companySs)),
      companySs,
      gerenteMemberSs: gerenteSs,
      profitBeforeTax: round2(profitBeforeTax),
      irc: round2(ircAmount),
      derrama: round2(derrama),
      netProfit: round2(netProfit),
    },
    person: {
      gerenteNetSalary,
      dividendsGross: round2(dividendsGross),
      dividendTax: round2(dividendTax),
      dividendsNet: round2(dividendsNet),
      takeHomeAnnual,
      takeHomeMonthlyEquivalent: round2(d(takeHomeAnnual).dividedBy(12)),
    },
    effectiveTaxRate,
  };
}
