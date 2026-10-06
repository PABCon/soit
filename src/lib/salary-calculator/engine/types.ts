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
