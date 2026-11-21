import {
  calculateDismissalScenario,
  calculateFixedTermScenario,
  calculateResignationScenario,
  calculateMutualAgreementScenario,
  type DismissalScenarioResult,
  type FixedTermScenarioResult,
  type ResignationScenarioResult,
  type MutualAgreementScenarioResult,
} from "@/lib/termination-calculator/orchestrate";
import type { TerminationCalculatorState, TerminationCalculatorMode } from "@/lib/termination-calculator/url-state";

/** The chat assistant's termination-calculator tool, same shape as
 *  `search-jobs.ts`: a plain, dependency-free function, zod validation
 *  lives in the route. Zero new calculation logic, pure dispatch over
 *  the four scenario orchestrators in `orchestrate.ts`, which themselves
 *  are pure composition of the already-shipped, already-tested engine
 *  functions. `state` is always returned (even for an error) using
 *  real-or-defaulted values, so the caller can always build a working
 *  shareable `/rescisao-contrato?s=...` link pointed at the right mode. */
export type CalculateTerminationArgs = {
  scenario: TerminationCalculatorMode;
  monthlyRemuneration: number;
  /** ISO date (YYYY-MM-DD). */
  contractStartDate: string;
  /** ISO date (YYYY-MM-DD). Defaults to today, matching the calculator's
   *  own "what if I left today" framing when the user hasn't given an
   *  exact cessation date yet. */
  cessationDate?: string;
  unusedPriorYearHolidayDays?: number;
  /** Required when scenario is "resignation". */
  contractType?: "open_ended" | "fixed_term";
  fixedTermOriginalDurationMonths?: number;
  noticeDaysPlanned?: number;
  /** Required when scenario is "mutual_agreement". */
  offeredAmount?: number;
};

export type CalculateTerminationResult =
  | {
      ok: true;
      scenario: TerminationCalculatorMode;
      result: DismissalScenarioResult | FixedTermScenarioResult | ResignationScenarioResult | MutualAgreementScenarioResult;
      state: TerminationCalculatorState;
    }
  | { ok: false; reason: "missing_fields"; missing: string[] }
  | { ok: false; reason: "pre_oct_2013_not_supported" };

/** Same `shareUrl`-added-at-the-route-layer convention as
 *  `CalculateSalaryToolResult`, see its own doc comment. */
export type CalculateTerminationToolResult =
  | (Extract<CalculateTerminationResult, { ok: true }> & { shareUrl: string })
  | Extract<CalculateTerminationResult, { ok: false }>;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function calculateTermination(args: CalculateTerminationArgs): CalculateTerminationResult {
  const profile = {
    monthlyRemuneration: args.monthlyRemuneration,
    contractStartDate: args.contractStartDate,
    cessationDate: args.cessationDate ?? today(),
  };

  const state: TerminationCalculatorState = {
    mode: args.scenario,
    profile,
    unusedPriorYearHolidayDays: args.unusedPriorYearHolidayDays ?? 0,
    mutualAgreementOfferedAmount: args.offeredAmount ?? 0,
    resignationContractType: args.contractType ?? "open_ended",
    resignationFixedTermOriginalDurationMonths: args.fixedTermOriginalDurationMonths ?? 0,
    resignationNoticeDaysPlanned: args.noticeDaysPlanned ?? 30,
  };

  if (args.scenario === "dismissal") {
    const result = calculateDismissalScenario(profile, args.unusedPriorYearHolidayDays);
    if (result.severance.preOct2013NotSupported) return { ok: false, reason: "pre_oct_2013_not_supported" };
    return { ok: true, scenario: args.scenario, result, state };
  }

  if (args.scenario === "fixed_term") {
    const result = calculateFixedTermScenario(profile, args.unusedPriorYearHolidayDays);
    if (result.compensation.preOct2013NotSupported) return { ok: false, reason: "pre_oct_2013_not_supported" };
    return { ok: true, scenario: args.scenario, result, state };
  }

  if (args.scenario === "resignation") {
    const missing: string[] = [];
    if (args.contractType == null) missing.push("contractType");
    if (args.noticeDaysPlanned == null) missing.push("noticeDaysPlanned");
    if (missing.length > 0) return { ok: false, reason: "missing_fields", missing };
    const result = calculateResignationScenario(
      {
        profile,
        contractType: args.contractType!,
        fixedTermOriginalDurationMonths: args.fixedTermOriginalDurationMonths,
        noticeDaysPlanned: args.noticeDaysPlanned!,
      },
      args.unusedPriorYearHolidayDays,
    );
    return { ok: true, scenario: args.scenario, result, state };
  }

  // mutual_agreement
  if (args.offeredAmount == null) {
    return { ok: false, reason: "missing_fields", missing: ["offeredAmount"] };
  }
  const result = calculateMutualAgreementScenario({ profile, offeredAmount: args.offeredAmount }, args.unusedPriorYearHolidayDays);
  if (result.comparison.preOct2013NotSupported) return { ok: false, reason: "pre_oct_2013_not_supported" };
  return { ok: true, scenario: args.scenario, result, state };
}
