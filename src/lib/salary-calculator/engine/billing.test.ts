import { describe, expect, it } from "vitest";
import { billingToMonthly, billingToAnnual, deriveYearOfActivity } from "./billing";

describe("billingToMonthly / billingToAnnual", () => {
  it("passes a monthly amount through unchanged", () => {
    expect(billingToMonthly({ mode: "monthly", amount: 2000 })).toBe(2000);
    expect(billingToAnnual({ mode: "monthly", amount: 2000 })).toBe(24000);
  });

  it("divides an annual amount by 12", () => {
    expect(billingToMonthly({ mode: "annual", amount: 24000 })).toBe(2000);
  });

  it("converts a day rate using the default 220 days/year when none is given", () => {
    expect(billingToMonthly({ mode: "dayRate", amount: 300 })).toBeCloseTo((300 * 220) / 12, 5);
  });

  it("uses an explicit daysPerYear when given", () => {
    expect(billingToMonthly({ mode: "dayRate", amount: 300, daysPerYear: 240 })).toBeCloseTo((300 * 240) / 12, 5);
  });
});

describe("deriveYearOfActivity", () => {
  it("buckets months since start into year 1/2/3+", () => {
    expect(deriveYearOfActivity(0)).toBe(1);
    expect(deriveYearOfActivity(11)).toBe(1);
    expect(deriveYearOfActivity(12)).toBe(2);
    expect(deriveYearOfActivity(23)).toBe(2);
    expect(deriveYearOfActivity(24)).toBe(3);
    expect(deriveYearOfActivity(100)).toBe(3);
  });
});
