import { describe, expect, it } from "vitest";
import { calculateTermination } from "./calculate-termination";

describe("calculateTermination", () => {
  it("computes a dismissal scenario, combining severance and entitlements", () => {
    const result = calculateTermination({
      scenario: "dismissal",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
      cessationDate: "2026-01-15",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toHaveProperty("severance");
    expect(result.result).toHaveProperty("entitlements");
    expect(result.state.mode).toBe("dismissal");
  });

  it("refuses to compute a number for a pre-October-2013 contract rather than return zeroed values", () => {
    const result = calculateTermination({
      scenario: "dismissal",
      monthlyRemuneration: 2000,
      contractStartDate: "2010-01-01",
      cessationDate: "2026-01-01",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("pre_oct_2013_not_supported");
  });

  it("reports missing_fields for resignation when contractType/noticeDaysPlanned aren't given", () => {
    const result = calculateTermination({
      scenario: "resignation",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "missing_fields") return;
    expect(result.missing).toEqual(["contractType", "noticeDaysPlanned"]);
  });

  it("computes a resignation scenario once the required fields are given", () => {
    const result = calculateTermination({
      scenario: "resignation",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
      contractType: "open_ended",
      noticeDaysPlanned: 30,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toHaveProperty("notice");
  });

  it("reports missing_fields for mutual_agreement when offeredAmount isn't given", () => {
    const result = calculateTermination({
      scenario: "mutual_agreement",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
    });
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "missing_fields") return;
    expect(result.missing).toEqual(["offeredAmount"]);
  });

  it("computes a mutual_agreement scenario once offeredAmount is given", () => {
    const result = calculateTermination({
      scenario: "mutual_agreement",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
      offeredAmount: 5000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toHaveProperty("comparison");
  });

  it("defaults cessationDate to today when omitted", () => {
    const result = calculateTermination({
      scenario: "fixed_term",
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.profile.cessationDate).toBe(new Date().toISOString().slice(0, 10));
  });
});
