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
};

export type MonthlyWithholdingResult = {
  retention: number;
  tableUsed: string;
  rate: number;
  taxableRemuneration: number;
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
  ss: number;
  irs: number;
  net: number;
  netIncludingMeal: number;
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
