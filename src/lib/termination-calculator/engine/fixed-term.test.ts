import { describe, expect, it } from "vitest";
import { calculateFixedTermCompensation } from "./fixed-term";

describe("calculateFixedTermCompensation", () => {
  it("computes 24 days/year for an exact 2-year tenure", () => {
    const result = calculateFixedTermCompensation({
      monthlyRemuneration: 1500,
      contractStartDate: "2023-06-01",
      cessationDate: "2025-06-01",
    });
    expect(result.preOct2013NotSupported).toBe(false);
    // (1500/30) * 24 * 2 = 2,400.00
    expect(result.amount).toBeCloseTo(2400, 2);
  });

  it("refuses to compute a number for a pre-October-2013 contract", () => {
    const result = calculateFixedTermCompensation({
      monthlyRemuneration: 1500,
      contractStartDate: "2012-01-01",
      cessationDate: "2026-01-01",
    });
    expect(result.preOct2013NotSupported).toBe(true);
    expect(result.amount).toBe(0);
  });
});
