import { calculateSeverance } from "./engine/severance";
import { calculateFixedTermCompensation } from "./engine/fixed-term";
import { calculateResignationNotice } from "./engine/resignation";
import { calculateMutualAgreementComparison } from "./engine/mutual-agreement";
import { calculateProportionalEntitlements } from "./engine/proportionals";
import type {
  TerminationProfile,
  SeveranceResult,
  FixedTermCompensationResult,
  ResignationInput,
  ResignationResult,
  MutualAgreementInput,
  MutualAgreementResult,
  ProportionalEntitlementsResult,
} from "./engine/types";

/**
 * `TerminationCalculatorForm.tsx` computes each scenario's own engine
 * function *and* `calculateProportionalEntitlements` as parallel,
 * independent `useMemo`s, always shown together, there is no single
 * existing entry point per scenario. These four functions collapse that
 * exact pairing into one callable unit each, so the chat assistant's
 * `calculateTermination` tool (and any other future non-UI caller) can
 * get the full, correct picture in one call instead of reimplementing
 * the pairing itself. No new calculation logic, pure composition of
 * already-shipped, already-tested engine functions.
 */

export type DismissalScenarioResult = {
  severance: SeveranceResult;
  entitlements: ProportionalEntitlementsResult;
};

export function calculateDismissalScenario(
  profile: TerminationProfile,
  unusedPriorYearHolidayDays?: number,
): DismissalScenarioResult {
  return {
    severance: calculateSeverance(profile),
    entitlements: calculateProportionalEntitlements({ profile, unusedPriorYearHolidayDays }),
  };
}

export type FixedTermScenarioResult = {
  compensation: FixedTermCompensationResult;
  entitlements: ProportionalEntitlementsResult;
};

export function calculateFixedTermScenario(
  profile: TerminationProfile,
  unusedPriorYearHolidayDays?: number,
): FixedTermScenarioResult {
  return {
    compensation: calculateFixedTermCompensation(profile),
    entitlements: calculateProportionalEntitlements({ profile, unusedPriorYearHolidayDays }),
  };
}

export type ResignationScenarioResult = {
  notice: ResignationResult;
  entitlements: ProportionalEntitlementsResult;
};

export function calculateResignationScenario(
  input: ResignationInput,
  unusedPriorYearHolidayDays?: number,
): ResignationScenarioResult {
  return {
    notice: calculateResignationNotice(input),
    entitlements: calculateProportionalEntitlements({ profile: input.profile, unusedPriorYearHolidayDays }),
  };
}

export type MutualAgreementScenarioResult = {
  comparison: MutualAgreementResult;
  entitlements: ProportionalEntitlementsResult;
};

export function calculateMutualAgreementScenario(
  input: MutualAgreementInput,
  unusedPriorYearHolidayDays?: number,
): MutualAgreementScenarioResult {
  return {
    comparison: calculateMutualAgreementComparison(input),
    entitlements: calculateProportionalEntitlements({ profile: input.profile, unusedPriorYearHolidayDays }),
  };
}
