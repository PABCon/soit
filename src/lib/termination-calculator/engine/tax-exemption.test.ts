import { describe, expect, it } from "vitest";
import { calculateSeveranceTaxExemption } from "./tax-exemption";

describe("calculateSeveranceTaxExemption", () => {
  it("exempts up to avgMonthly x years when that's lower than the 240x RMMG absolute cap", () => {
    const result = calculateSeveranceTaxExemption(15000, 2000, 5, 2026);
    // formula cap: 2000 * 5 = 10,000; absolute cap: 240 * 920 = 220,800
    expect(result.exemptionCapFormula).toBe(10000);
    expect(result.exemptionCapAbsolute).toBe(220800);
    expect(result.exemptAmount).toBe(10000);
    expect(result.taxableAmount).toBe(5000);
  });

  it("exempts the full compensation when it's under the formula cap", () => {
    const result = calculateSeveranceTaxExemption(5000, 2000, 5, 2026);
    expect(result.exemptAmount).toBe(5000);
    expect(result.taxableAmount).toBe(0);
  });
});
