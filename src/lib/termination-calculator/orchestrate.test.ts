import { describe, expect, it } from "vitest";
import {
  calculateDismissalScenario,
  calculateFixedTermScenario,
  calculateResignationScenario,
  calculateMutualAgreementScenario,
} from "./orchestrate";
import { calculateSeverance } from "./engine/severance";
import { calculateFixedTermCompensation } from "./engine/fixed-term";
import { calculateResignationNotice } from "./engine/resignation";
import { calculateMutualAgreementComparison } from "./engine/mutual-agreement";
import { calculateProportionalEntitlements } from "./engine/proportionals";

const PROFILE = { monthlyRemuneration: 2000, contractStartDate: "2021-01-15", cessationDate: "2026-01-15" };

describe("calculateDismissalScenario", () => {
  it("combines calculateSeverance and calculateProportionalEntitlements, matching each called directly", () => {
    const combined = calculateDismissalScenario(PROFILE, 3);
    expect(combined.severance).toEqual(calculateSeverance(PROFILE));
    expect(combined.entitlements).toEqual(
      calculateProportionalEntitlements({ profile: PROFILE, unusedPriorYearHolidayDays: 3 }),
    );
  });
});

describe("calculateFixedTermScenario", () => {
  it("combines calculateFixedTermCompensation and calculateProportionalEntitlements", () => {
    const combined = calculateFixedTermScenario(PROFILE);
    expect(combined.compensation).toEqual(calculateFixedTermCompensation(PROFILE));
    expect(combined.entitlements).toEqual(calculateProportionalEntitlements({ profile: PROFILE }));
  });
});

describe("calculateResignationScenario", () => {
  it("combines calculateResignationNotice and calculateProportionalEntitlements", () => {
    const input = { profile: PROFILE, contractType: "open_ended" as const, noticeDaysPlanned: 30 };
    const combined = calculateResignationScenario(input);
    expect(combined.notice).toEqual(calculateResignationNotice(input));
    expect(combined.entitlements).toEqual(calculateProportionalEntitlements({ profile: PROFILE }));
  });
});

describe("calculateMutualAgreementScenario", () => {
  it("combines calculateMutualAgreementComparison and calculateProportionalEntitlements", () => {
    const input = { profile: PROFILE, offeredAmount: 5000 };
    const combined = calculateMutualAgreementScenario(input);
    expect(combined.comparison).toEqual(calculateMutualAgreementComparison(input));
    expect(combined.entitlements).toEqual(calculateProportionalEntitlements({ profile: PROFILE }));
  });
});
