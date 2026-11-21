import { describe, expect, it } from "vitest";
import { calculateSeniority, fullMonthsInCessationYear } from "./seniority";

describe("calculateSeniority", () => {
  it("computes an exact whole-year tenure with zero extra days", () => {
    const result = calculateSeniority("2020-01-15", "2025-01-15");
    expect(result.fullYears).toBe(5);
    expect(result.extraDays).toBe(0);
    expect(result.yearsDecimal).toBeCloseTo(5, 5);
  });

  it("counts a partial year as extra days since the last anniversary", () => {
    const result = calculateSeniority("2023-01-01", "2025-07-03");
    expect(result.fullYears).toBe(2);
    expect(result.extraDays).toBe(183);
  });

  it("flags a contract starting before 1 October 2013", () => {
    expect(calculateSeniority("2013-09-30", "2026-01-01").isPreOct2013).toBe(true);
    expect(calculateSeniority("2013-10-01", "2026-01-01").isPreOct2013).toBe(false);
  });
});

describe("fullMonthsInCessationYear", () => {
  it("counts from the contract start when hired during the cessation year itself", () => {
    expect(fullMonthsInCessationYear("2026-01-01", "2026-04-01")).toBe(3);
  });

  it("counts from January 1st when the contract started in an earlier year", () => {
    expect(fullMonthsInCessationYear("2022-03-01", "2025-06-01")).toBe(5);
  });
});
