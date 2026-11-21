import { describe, expect, it } from "vitest";
import { calculateProportionalEntitlements } from "./proportionals";

describe("calculateProportionalEntitlements", () => {
  it("computes proportional holiday + Christmas subsidy + unused prior-year holiday payout", () => {
    const result = calculateProportionalEntitlements({
      profile: {
        monthlyRemuneration: 2200,
        contractStartDate: "2022-03-01",
        cessationDate: "2025-06-01",
      },
      unusedPriorYearHolidayDays: 3,
    });
    expect(result.fullMonthsWorkedInCessationYear).toBe(5);
    // 5 months * 2 days/month = 10 days; 10 * (2200/30) = 733.33
    expect(result.proportionalHolidayDays).toBe(10);
    expect(result.proportionalHolidayPay).toBeCloseTo(733.33, 2);
    // 2200 * 5/12 = 916.67
    expect(result.proportionalChristmasSubsidy).toBeCloseTo(916.67, 2);
    // 3 * (2200/30) = 220.00
    expect(result.unusedPriorYearHolidayPay).toBeCloseTo(220, 2);
    expect(result.total).toBeCloseTo(1870, 2);
  });

  it("zero-fills when there's no unused prior-year holiday and the contract started this same year", () => {
    const result = calculateProportionalEntitlements({
      profile: {
        monthlyRemuneration: 2000,
        contractStartDate: "2026-01-01",
        cessationDate: "2026-04-01",
      },
    });
    expect(result.fullMonthsWorkedInCessationYear).toBe(3);
    expect(result.unusedPriorYearHolidayPay).toBe(0);
  });
});
