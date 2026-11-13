import { describe, expect, it } from "vitest";
import { calculateSeverance } from "./severance";

describe("calculateSeverance", () => {
  it("computes 14 days/year for an exact 5-year tenure, uncapped", () => {
    const result = calculateSeverance({
      monthlyRemuneration: 2000,
      contractStartDate: "2021-01-15",
      cessationDate: "2026-01-15",
    });
    expect(result.preOct2013NotSupported).toBe(false);
    expect(result.yearsOfService).toBeCloseTo(5, 5);
    expect(result.cappedMonthlyBase).toBe(2000);
    // (2000/30) * 14 * 5 = 4,666.67
    expect(result.amount).toBeCloseTo(4666.67, 2);
    expect(result.wasCapped).toBe(false);
  });

  it("caps the salary base at 20x RMMG (2026: 920 -> 18,400) for a high earner", () => {
    const result = calculateSeverance({
      monthlyRemuneration: 25000,
      contractStartDate: "2021-01-15",
      cessationDate: "2026-01-15",
    });
    expect(result.cappedMonthlyBase).toBe(18400);
    // (18400/30) * 14 * 5 = 42,933.33, comfortably under the 12x total
    // cap (12 * 18,400 = 220,800), so the total cap doesn't bind here.
    expect(result.amount).toBeCloseTo(42933.33, 2);
    expect(result.totalCap).toBe(220800);
    expect(result.wasCapped).toBe(false);
  });

  it("refuses to compute a number for a pre-October-2013 contract", () => {
    const result = calculateSeverance({
      monthlyRemuneration: 2000,
      contractStartDate: "2010-01-01",
      cessationDate: "2026-01-01",
    });
    expect(result.preOct2013NotSupported).toBe(true);
    expect(result.amount).toBe(0);
  });

  it("prorates a partial year", () => {
    // 2 years + ~6 months (183 days) of tenure.
    const result = calculateSeverance({
      monthlyRemuneration: 3000,
      contractStartDate: "2024-01-01",
      cessationDate: "2026-07-03",
    });
    expect(result.yearsOfService).toBeGreaterThan(2.4);
    expect(result.yearsOfService).toBeLessThan(2.6);
  });
});
