import type { Region } from "../rules/loader";

export type { Region };

export type MaritalStatus = "single" | "married_two_earners" | "married_single_earner";

export type IrsJovemBenefitYear = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Shared input profile (spec §2) — collected once, reused by every mode. */
export type Profile = {
  year: number;
  month: number; // 1-12, selects withholding table version
  region: Region;
  maritalStatus: MaritalStatus;
  dependents: number;
  dependentsUnder3: number;
  dependentsWithDisability: number;
  /** The taxpayer's own disability (grau de incapacidade >= 60%) — this is
   *  what actually selects the disability withholding tables (IV-VII); the
   *  official tables have no separate variant keyed on `spouseHasDisability`
   *  (see withholding.ts for the resolved table-selection mapping). */
  disabilityAbove60: boolean;
  spouseHasDisability: boolean;
  age: number;
  irsJovem: { enabled: boolean; benefitYear: IrsJovemBenefitYear };
  /** IFICI or legacy RNH — user self-declares eligibility; the calculator
   *  doesn't decide it (spec §2 UI notes). */
  flatRate20: boolean;
};

export type MealInput = {
  type: "none" | "cash" | "card";
  dailyValue: number;
  daysPerMonth: number;
};

/** Mode A inputs (spec §3.1). */
export type EmploymentInput = {
  grossMonthly: number;
  paymentsPerYear: 14 | 12;
  /** duodécimos: none, 50% of each subsidy spread monthly, or 100%. */
  twelfths: "none" | "half" | "full";
  meal: MealInput;
  otherTaxableMonthly?: number;
  /** A free-entry amount the user declares as fully exempt from both IRS
   *  and Social Security (e.g. ajudas de custo / travel allowance). Added
   *  straight to net pay; never enters either tax base. */
  exemptAllowanceMonthly?: number;
  /** A free-entry amount that's subject to IRS but exempt from Social
   *  Security (e.g. flexible-benefits platforms) — widens the IRS
   *  withholding base but is explicitly excluded from the SS base, on
   *  both the employee and employer side. */
  irsApplicableAllowanceMonthly?: number;
};

export type MonthlyWithholdingResult = {
  retention: number;
  tableUsed: string;
  rate: number;
  taxableRemuneration: number;
  /** The table's flat (or transitional-formula) abatement for this
   *  bracket, before the per-dependent deduction — exposed so the UI can
   *  show its own calculation breakdown, not just the final number. */
  parcela: number;
  dependentDeduction: number;
};

export type MealAllowanceSplit = {
  taxableDaily: number;
  exemptDaily: number;
  taxableMonthly: number;
  exemptMonthly: number;
};

export type EmploymentMonthly = {
  gross: number;
  /** This month's share of a spread subsidy (duodécimos) — 0 unless
   *  `twelfths` is "half" or "full". Already folded into `ss`/`irs`/`net`
   *  below; broken out here so the UI can show it as its own line
   *  instead of silently inflating "gross". */
  duodecimoGross: number;
  taxableMeal: number;
  exemptMeal: number;
  /** Exempt from both IRS and SS (see `EmploymentInput`). */
  exemptAllowance: number;
  /** IRS-applicable, SS-exempt (see `EmploymentInput`). */
  irsApplicableAllowance: number;
  ss: number;
  irs: number;
  net: number;
  netIncludingMeal: number;
  /** The IRS base, SS base, and the withholding table's own mechanics —
   *  exposed so the UI can show a transparent calculation breakdown
   *  instead of just the final withheld amount. */
  irsBase: number;
  ssBase: number;
  irsRate: number;
  irsTableUsed: string;
  irsParcela: number;
  irsDependentDeduction: number;
};

export type SubsidyMonth = {
  gross: number;
  ss: number;
  irs: number;
  net: number;
};

export type EmploymentResult = {
  monthly: EmploymentMonthly;
  subsidyMonths: { holiday: SubsidyMonth; christmas: SubsidyMonth } | null;
  annual: {
    gross: number;
    ss: number;
    irsWithheld: number;
    net: number;
    netIncludingMeal: number;
  };
  employerCost: { annual: number; monthlyEquivalent: number };
  annualSettlementEstimate?: AnnualIrsResult;
};

export type AnnualIrsResult = {
  rendimentoColetavel: number;
  coleta: number;
  solidarityExtra: number;
  deducoes: number;
  irsLiquidado: number;
  withheld: number;
  settlement: number; // +pay / -refund
};

// Mode B: recibos verdes (independent worker) — spec §4.

export type ActivityType = "art151" | "other_services";
export type ClientLocation = "pt" | "eu" | "non_eu";
export type VatRegime = "art53_exempt" | "normal";

/** Shared "how is this billed" shape — a flat monthly/annual amount, or a
 *  day rate (converted via a documented placeholder day-count, see
 *  `billing.ts`). Used by Mode B's own invoicing and Mode C's company
 *  revenue, so both can be entered the way the person actually thinks
 *  about their income. */
export type BillingInput = { mode: "monthly" | "annual" | "dayRate"; amount: number; daysPerYear?: number };

export type FreelanceInput = {
  billing: BillingInput;
  activityType: ActivityType;
  clientLocation: ClientLocation;
  /** Months of activity so far — drives both the SS 12-month exemption
   *  and the Cat B new-activity coefficient reduction (50% in months
   *  1-12, 25% in months 13-24, none from month 25 on). One field, not
   *  two: "months since start" and "year of activity" are the same fact
   *  stated twice, which was confusing rather than meaningfully
   *  different inputs. */
  monthsSinceStart: number;
  /** Self-declared, no amount needed: only affects (a) whether the SS
   *  acumulação exemption can apply — which depends on this freelance
   *  income alone, not on the other job's salary — and (b) whether the
   *  new-activity coefficient reduction is disqualified by other Cat A
   *  income. Earlier versions also asked for the other job's gross and
   *  merged its estimated tax into this freelance income's own annual
   *  IRS liability — which distorted the headline trueNet figure with
   *  tax attributable to income this calculator never otherwise sees.
   *  Removed rather than fixed: a correct combined-household estimate
   *  needs the full annual IRS engine tracking both incomes and their
   *  separate withholding properly, which is a different feature. */
  alsoEmployed: boolean;
  /** Annual — feeds the 15% justification rule (spec §4.5). */
  declaredExpenses: number;
  vatRegime: VatRegime;
  /** Dispensa art. 101.º-B CIRS — only valid while annual Cat B income is
   *  expected under the Cat B rule set's dispensa threshold. */
  withholdingWaiver: boolean;
  /** "Fixação do valor-base" — adjusts the SS contribution base by this
   *  fraction (±25% in 5% steps), a real self-service SS mechanism. */
  baseAdjustmentPct?: number;
};

export type FreelanceMonthly = {
  invoiced: number;
  vatOnInvoice: number;
  irsWithheld: number;
  ss: number;
  /** invoiced − ss − this month's actual IRS withholding. What really
   *  lands in the account this month. */
  cashInHand: number;
  /** invoiced − ss − (annual IRS liability ÷ 12). The more accurate
   *  "real" monthly take-home once the annual settlement is accounted
   *  for, independent of how withholding happens to fall month to month
   *  (spec §4.6: shown as the headline, with cashInHand as secondary). */
  trueNet: number;
};

export type FreelanceResult = {
  monthly: FreelanceMonthly;
  annual: {
    invoiced: number;
    ss: number;
    irsWithheld: number;
    irsLiability: number;
    trueNet: number;
  };
  /** Estimated annual IRS ÷ 12 — "the single most useful output for IT
   *  freelancers working for foreign clients" (spec §4.3): how much to
   *  set aside each month since foreign clients don't withhold PT tax. */
  recommendedMonthlyTaxReserve: number;
  flags: string[];
};

// Mode C: empresa própria (Sociedade Unipessoal Lda) — spec §5.

export type CompanyInput = {
  revenue: BillingInput;
  clientLocation: ClientLocation;
  gerenteGrossMonthly: number;
  gerentePaymentsPerYear: 12 | 14;
  operatingExpensesAnnual: number;
  accountantMonthly: number;
  municipalSurchargeRate: number;
  isSME: boolean;
  distributeAllProfit: boolean;
  /** Self-declared: an unpaid gerente who is already covered by another
   *  mandatory SS regime (e.g. employed elsewhere) earning > 1×IAS there
   *  is exempt from the gerente SS obligation (confirmed via OCC
   *  guidance) — not modeled beyond this single self-declared flag. */
  gerenteExemptViaOtherActivity?: boolean;
};

export type CompanyResult = {
  company: {
    revenue: number;
    expenses: number;
    gerenteCost: number;
    companySs: number;
    /** The member's own 11% share, on the same SS base as `companySs` —
     *  shown for transparency (23.75% + 11% = 34.75% combined), not
     *  separately subtracted here: it's already reflected inside
     *  `person.gerenteNetSalary` via the Mode A withholding run. */
    gerenteMemberSs: number;
    profitBeforeTax: number;
    irc: number;
    derrama: number;
    netProfit: number;
  };
  person: {
    gerenteNetSalary: number;
    dividendsGross: number;
    dividendTax: number;
    dividendsNet: number;
    takeHomeAnnual: number;
    takeHomeMonthlyEquivalent: number;
  };
  /** (revenue − takeHome − expenses) / (revenue − expenses) — spec §5.4. */
  effectiveTaxRate: number;
};
