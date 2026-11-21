import { describe, expect, it } from "vitest";
import { calculateResignationNotice } from "./resignation";

describe("calculateResignationNotice", () => {
  it("requires 60 days' notice for an open-ended contract with >2 years of tenure, and charges the shortfall", () => {
    const result = calculateResignationNotice({
      profile: {
        monthlyRemuneration: 1800,
        contractStartDate: "2022-01-01",
        cessationDate: "2025-01-01",
      },
      contractType: "open_ended",
      noticeDaysPlanned: 30,
    });
    expect(result.noticeDaysRequired).toBe(60);
    expect(result.shortfallDays).toBe(30);
    // 1800/30 = 60/day; 60 * 30 shortfall days = 1,800.00
    expect(result.compensationOwed).toBeCloseTo(1800, 2);
  });

  it("requires only 30 days' notice for an open-ended contract with <=2 years of tenure", () => {
    const result = calculateResignationNotice({
      profile: {
        monthlyRemuneration: 1800,
        contractStartDate: "2024-01-01",
        cessationDate: "2025-01-01",
      },
      contractType: "open_ended",
      noticeDaysPlanned: 30,
    });
    expect(result.noticeDaysRequired).toBe(30);
    expect(result.shortfallDays).toBe(0);
    expect(result.compensationOwed).toBe(0);
  });

  it("requires 15 days for a fixed-term contract under 6 months, 30 for 6+ months", () => {
    const short = calculateResignationNotice({
      profile: { monthlyRemuneration: 1200, contractStartDate: "2025-01-01", cessationDate: "2025-03-01" },
      contractType: "fixed_term",
      fixedTermOriginalDurationMonths: 3,
      noticeDaysPlanned: 0,
    });
    expect(short.noticeDaysRequired).toBe(15);

    const long = calculateResignationNotice({
      profile: { monthlyRemuneration: 1200, contractStartDate: "2025-01-01", cessationDate: "2025-09-01" },
      contractType: "fixed_term",
      fixedTermOriginalDurationMonths: 12,
      noticeDaysPlanned: 0,
    });
    expect(long.noticeDaysRequired).toBe(30);
  });
});
