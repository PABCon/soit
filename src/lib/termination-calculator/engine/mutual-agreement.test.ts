import { describe, expect, it } from "vitest";
import { calculateMutualAgreementComparison } from "./mutual-agreement";

describe("calculateMutualAgreementComparison", () => {
  it("expresses the offered amount as a percentage of the equivalent-dismissal benchmark", () => {
    const result = calculateMutualAgreementComparison({
      profile: {
        monthlyRemuneration: 2000,
        contractStartDate: "2021-01-15",
        cessationDate: "2026-01-15",
      },
      offeredAmount: 3000,
    });
    expect(result.preOct2013NotSupported).toBe(false);
    // Benchmark severance for this profile is 4,666.67 (same as severance.test.ts).
    expect(result.benchmarkSeverance.amount).toBeCloseTo(4666.67, 2);
    expect(result.offeredAsPercentOfBenchmark).toBeCloseTo(64.3, 1);
  });

  it("returns a null percentage rather than a number for a pre-2013 contract", () => {
    const result = calculateMutualAgreementComparison({
      profile: {
        monthlyRemuneration: 2000,
        contractStartDate: "2010-01-01",
        cessationDate: "2026-01-01",
      },
      offeredAmount: 3000,
    });
    expect(result.preOct2013NotSupported).toBe(true);
    expect(result.offeredAsPercentOfBenchmark).toBeNull();
  });
});
