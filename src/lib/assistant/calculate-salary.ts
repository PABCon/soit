import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";
import { calculateFreelanceNet } from "@/lib/salary-calculator/engine/freelance";
import { calculateCompanyNet } from "@/lib/salary-calculator/engine/company";
import type {
  Profile,
  EmploymentResult,
  FreelanceResult,
  CompanyResult,
  Region,
  MaritalStatus,
  IrsJovemBenefitYear,
  ActivityType,
  ClientLocation,
} from "@/lib/salary-calculator/engine/types";
import type { SalaryCalculatorState, CalculatorMode } from "@/lib/salary-calculator/url-state";

/** The chat assistant's salary-calculator tool, same shape as
 *  `search-jobs.ts`: a plain, dependency-free function, zod validation
 *  lives in the route. Zero new calculation logic, pure dispatch over
 *  the three already-shipped, already-tested, already-single-entry-point
 *  engine functions (`calculateEmploymentNet`/`calculateFreelanceNet`/
 *  `calculateCompanyNet`).
 *
 *  Every field beyond the mode's own one or two essential inputs is
 *  optional and defaulted here to the *exact same values*
 *  `SalaryCalculatorForm.tsx`'s own `DEFAULT_PROFILE`/
 *  `DEFAULT_EMPLOYMENT_INPUT`/`DEFAULT_FREELANCE_INPUT`/
 *  `DEFAULT_COMPANY_INPUT` already use (duplicated here rather than
 *  imported, same reasoning as every other cross-feature default/
 *  constant duplication in this codebase, that file is a client
 *  component, not a shared lib), so "what's my take-home on 2500" works
 *  without JT having to interrogate the user for every field, while
 *  still being driven by the same defaults real candidates already see
 *  on the actual page, never invented numbers. */
export type CalculateSalaryArgs = {
  mode: CalculatorMode;
  // Shared profile overrides.
  age?: number;
  region?: Region;
  maritalStatus?: MaritalStatus;
  dependents?: number;
  disabilityAbove60?: boolean;
  irsJovemEnabled?: boolean;
  /** 1-10; the route's own zod schema already enforces this range
   *  (`.min(1).max(10)`) before it ever reaches here, so this stays a
   *  plain `number` rather than the engine's own branded
   *  `IrsJovemBenefitYear` union, which a raw tool-call arg can't be
   *  assumed to satisfy structurally. */
  irsJovemBenefitYear?: number;
  flatRate20?: boolean;
  // Mode A (employment).
  grossMonthly?: number;
  paymentsPerYear?: 12 | 14;
  // Mode B (freelance) / Mode C (company) revenue.
  billingAmount?: number;
  billingMode?: "monthly" | "annual" | "dayRate";
  activityType?: ActivityType;
  clientLocation?: ClientLocation;
  monthsSinceStart?: number;
  // Mode C (company) only.
  gerenteGrossMonthly?: number;
};

export type CalculateSalaryResult =
  | {
      ok: true;
      mode: CalculatorMode;
      result: EmploymentResult | FreelanceResult | CompanyResult;
      state: SalaryCalculatorState;
    }
  | { ok: false; reason: "missing_fields"; missing: string[] };

/** The route's own tool `execute` adds a `shareUrl` (built from
 *  `state` via `encodeState()`, which needs `NEXT_PUBLIC_SITE_URL`/
 *  locale, both only known at the route layer) to the `ok: true` case
 *  before returning. Exported here so the client can cast `part.output`
 *  to a real type, same convention as `SearchJobsResult`. */
export type CalculateSalaryToolResult =
  | (Extract<CalculateSalaryResult, { ok: true }> & { shareUrl: string })
  | Extract<CalculateSalaryResult, { ok: false }>;

// Same literal defaults as SalaryCalculatorForm.tsx's own DEFAULT_*
// constants, used to fill out whichever mode isn't the one actively
// computed (see SalaryCalculatorState's own doc comment: all three
// modes' inputs always travel together so switching tabs on a shared
// link never resets the ones not actively computed).
const DEFAULT_EMPLOYMENT_INPUT = {
  grossMonthly: 1500,
  paymentsPerYear: 14 as const,
  twelfths: "none" as const,
  meal: { type: "card" as const, dailyValue: 10.46, daysPerMonth: 22 },
  exemptAllowanceMonthly: 0,
  irsApplicableAllowanceMonthly: 0,
};

const DEFAULT_FREELANCE_INPUT = {
  billing: { mode: "monthly" as const, amount: 2000 },
  activityType: "art151" as const,
  clientLocation: "pt" as const,
  monthsSinceStart: 24,
  alsoEmployed: false,
  declaredExpenses: 0,
  vatRegime: "normal" as const,
  withholdingWaiver: false,
  baseAdjustmentPct: 0,
};

const DEFAULT_COMPANY_INPUT = {
  revenue: { mode: "annual" as const, amount: 80000 },
  clientLocation: "pt" as const,
  gerenteGrossMonthly: 2000,
  gerentePaymentsPerYear: 14 as const,
  operatingExpensesAnnual: 5000,
  accountantMonthly: 100,
  municipalSurchargeRate: 0.015,
  isSME: true,
  distributeAllProfit: true,
  gerenteExemptViaOtherActivity: false,
};

/** Clamped defensively (not just trusted from the route's own zod
 *  `.min(1).max(10)`) since this function is also called directly by
 *  unit tests and any other future caller that bypasses that schema. */
function clampBenefitYear(value: number | undefined): IrsJovemBenefitYear {
  const n = Math.round(value ?? 1);
  return Math.min(10, Math.max(1, n)) as IrsJovemBenefitYear;
}

function buildProfile(args: CalculateSalaryArgs): Profile {
  return {
    year: 2026,
    month: 1,
    region: args.region ?? "continente",
    maritalStatus: args.maritalStatus ?? "single",
    dependents: args.dependents ?? 0,
    dependentsUnder3: 0,
    dependentsWithDisability: 0,
    disabilityAbove60: args.disabilityAbove60 ?? false,
    spouseHasDisability: false,
    age: args.age ?? 30,
    irsJovem: { enabled: args.irsJovemEnabled ?? false, benefitYear: clampBenefitYear(args.irsJovemBenefitYear) },
    flatRate20: args.flatRate20 ?? false,
  };
}

export function calculateSalary(args: CalculateSalaryArgs): CalculateSalaryResult {
  const profile = buildProfile(args);

  if (args.mode === "employment") {
    if (args.grossMonthly == null) return { ok: false, reason: "missing_fields", missing: ["grossMonthly"] };
    const employmentInput = {
      grossMonthly: args.grossMonthly,
      paymentsPerYear: args.paymentsPerYear ?? (14 as const),
      twelfths: "none" as const,
      meal: { type: "card" as const, dailyValue: 10.46, daysPerMonth: 22 },
      exemptAllowanceMonthly: 0,
      irsApplicableAllowanceMonthly: 0,
    };
    const freelanceInput = DEFAULT_FREELANCE_INPUT;
    const companyInput = DEFAULT_COMPANY_INPUT;
    return {
      ok: true,
      mode: args.mode,
      result: calculateEmploymentNet(profile, employmentInput),
      state: { mode: args.mode, profile, employmentInput, freelanceInput, companyInput },
    };
  }

  if (args.mode === "freelance") {
    if (args.billingAmount == null) return { ok: false, reason: "missing_fields", missing: ["billingAmount"] };
    const freelanceInput = {
      billing: { mode: args.billingMode ?? ("monthly" as const), amount: args.billingAmount },
      activityType: args.activityType ?? ("art151" as const),
      clientLocation: args.clientLocation ?? ("pt" as const),
      monthsSinceStart: args.monthsSinceStart ?? 24,
      alsoEmployed: false,
      declaredExpenses: 0,
      vatRegime: "normal" as const,
      withholdingWaiver: false,
      baseAdjustmentPct: 0,
    };
    const employmentInput = DEFAULT_EMPLOYMENT_INPUT;
    const companyInput = DEFAULT_COMPANY_INPUT;
    return {
      ok: true,
      mode: args.mode,
      result: calculateFreelanceNet(profile, freelanceInput),
      state: { mode: args.mode, profile, employmentInput, freelanceInput, companyInput },
    };
  }

  // company
  if (args.billingAmount == null || args.gerenteGrossMonthly == null) {
    const missing: string[] = [];
    if (args.billingAmount == null) missing.push("billingAmount");
    if (args.gerenteGrossMonthly == null) missing.push("gerenteGrossMonthly");
    return { ok: false, reason: "missing_fields", missing };
  }
  const companyInput = {
    revenue: { mode: args.billingMode ?? ("annual" as const), amount: args.billingAmount },
    clientLocation: args.clientLocation ?? ("pt" as const),
    gerenteGrossMonthly: args.gerenteGrossMonthly,
    gerentePaymentsPerYear: 14 as const,
    operatingExpensesAnnual: 5000,
    accountantMonthly: 100,
    municipalSurchargeRate: 0.015,
    isSME: true,
    distributeAllProfit: true,
    gerenteExemptViaOtherActivity: false,
  };
  const employmentInput = DEFAULT_EMPLOYMENT_INPUT;
  const freelanceInput = DEFAULT_FREELANCE_INPUT;
  return {
    ok: true,
    mode: args.mode,
    result: calculateCompanyNet(profile, companyInput),
    state: { mode: args.mode, profile, employmentInput, freelanceInput, companyInput },
  };
}
