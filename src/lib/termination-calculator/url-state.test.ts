import { describe, expect, it } from "vitest";
import { encodeState, decodeState } from "./url-state";
import type { TerminationCalculatorState } from "./url-state";

const state: TerminationCalculatorState = {
  mode: "mutual_agreement",
  profile: {
    monthlyRemuneration: 2200,
    contractStartDate: "2021-03-01",
    cessationDate: "2026-06-01",
  },
  unusedPriorYearHolidayDays: 5,
  mutualAgreementOfferedAmount: 8000,
  resignationContractType: "open_ended",
  resignationFixedTermOriginalDurationMonths: 0,
  resignationNoticeDaysPlanned: 60,
};

describe("termination-calculator url-state round-trip (no personal data in it)", () => {
  it("decodes back to the exact same state", () => {
    const encoded = encodeState(state);
    expect(encoded).not.toMatch(/[+/=]/); // url-safe
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it("returns null for garbage input rather than throwing", () => {
    expect(decodeState("not valid base64 json at all!!")).toBeNull();
  });
});
