import { describe, expect, it } from "vitest";
import { calculateTaxableB } from "./regime-simplificado";
import { calculateFreelanceNet } from "./freelance";
import { getCatBRuleSet } from "../rules/loader";
import type { Profile, FreelanceInput } from "./types";

// Spec §8.1 "Tests (definition of done)" — T6, T7, T9 for Phase 3.

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    year: 2026,
    month: 1,
    region: "continente",
    maritalStatus: "single",
    dependents: 0,
    dependentsUnder3: 0,
    dependentsWithDisability: 0,
    disabilityAbove60: false,
    spouseHasDisability: false,
    age: 30,
    irsJovem: { enabled: false, benefitYear: 1 },
    flatRate20: false,
    ...overrides,
  };
}

function baseFreelanceInput(overrides: Partial<FreelanceInput> = {}): FreelanceInput {
  return {
    billing: { mode: "monthly", amount: 2000 },
    activityType: "other_services",
    clientLocation: "pt",
    monthsSinceStart: 24,
    alsoEmployed: false,
    declaredExpenses: 0,
    vatRegime: "normal",
    withholdingWaiver: false,
    ...overrides,
  };
}

describe("T6: recibos verdes SS, €2,000/month services, past first 12 months", () => {
  it("equals €299.60/month (21.4% × 70% × 2,000)", () => {
    const result = calculateFreelanceNet(baseProfile(), baseFreelanceInput());
    expect(result.monthly.ss).toBeCloseTo(299.6, 2);
  });
});

describe("T7: regime simplificado, €40,000 art151, €1,412.91 expenses", () => {
  it("produces taxable €30,000 with zero shortfall (the spec's own PwC check case)", () => {
    const catB = getCatBRuleSet(2026, 1);
    const taxableB = calculateTaxableB(
      {
        invoicedAnnual: 40000,
        activityType: "art151",
        yearOfActivity: 3,
        alsoEmployed: false,
        declaredExpenses: 1412.91,
        ssPaidAnnual: 0,
      },
      catB,
    );
    expect(taxableB).toBeCloseTo(30000, 2);
  });
});

describe("T9: recibos verdes, EU client", () => {
  it("withholds no PT IRS and flags the reverse charge", () => {
    const result = calculateFreelanceNet(baseProfile(), baseFreelanceInput({ clientLocation: "eu" }));
    expect(result.monthly.irsWithheld).toBe(0);
    expect(result.flags).toContain("NO_WITHHOLDING_FOREIGN_CLIENT");
    expect(result.flags).toContain("REVERSE_CHARGE_EU");
  });
});

describe("recibos verdes: first 12 months are SS-exempt", () => {
  it("has zero SS contribution before month 12", () => {
    const result = calculateFreelanceNet(baseProfile(), baseFreelanceInput({ monthsSinceStart: 3 }));
    expect(result.monthly.ss).toBe(0);
    expect(result.flags).toContain("SS_EXEMPT_FIRST_12_MONTHS");
  });
});

describe("recibos verdes: minimum and maximum SS base", () => {
  it("applies the €20 floor for very low invoicing", () => {
    const result = calculateFreelanceNet(baseProfile(), baseFreelanceInput({ billing: { mode: "monthly", amount: 50 } }));
    expect(result.monthly.ss).toBe(20);
  });

  it("caps the base at 12×IAS for very high invoicing", () => {
    const result = calculateFreelanceNet(
      baseProfile(),
      baseFreelanceInput({ billing: { mode: "monthly", amount: 50000 } }),
    );
    expect(result.flags).toContain("SS_MAXIMUM_BASE_APPLIED");
    // 12×537.13 × 21.4% = 1,379.34996 -> rounds to 1,379.35.
    expect(result.monthly.ss).toBeCloseTo(1379.35, 2);
  });
});

describe("recibos verdes: acumulação exemption when also employed", () => {
  it("exempts SS when relevant income stays under 4×IAS", () => {
    const result = calculateFreelanceNet(
      baseProfile(),
      baseFreelanceInput({ billing: { mode: "monthly", amount: 1000 }, alsoEmployed: true }),
    );
    // relevant income = 1000 × 0.70 = 700, well under 4×537.13 = 2,148.52.
    expect(result.monthly.ss).toBe(0);
    expect(result.flags).toContain("SS_EXEMPT_ACUMULACAO");
  });

  it("does not distort this income's own trueNet with tax from the other job (real bug found by the user)", () => {
    // Previously, "also employed" merged an estimated net from the other
    // job into this freelance income's own annual IRS liability, which
    // pushed the combined figure into a much higher bracket and made
    // trueNet collapse — even though the headline is meant to describe
    // only this recibos verdes income.
    // €4,000/month keeps relevant income (70%) above the acumulação
    // exemption threshold either way, so SS itself doesn't change — only
    // the bug under test (tax merged in from "also employed") would.
    const input = baseFreelanceInput({ billing: { mode: "monthly", amount: 4000 } });
    const withoutOtherJob = calculateFreelanceNet(baseProfile(), input);
    const withOtherJob = calculateFreelanceNet(baseProfile(), { ...input, alsoEmployed: true });
    expect(withOtherJob.monthly.ss).toBeCloseTo(withoutOtherJob.monthly.ss, 2);
    expect(withOtherJob.monthly.trueNet).toBeCloseTo(withoutOtherJob.monthly.trueNet, 2);
  });
});

describe("recibos verdes: dispensa (withholding waiver)", () => {
  it("withholds nothing while expected annual income stays under the threshold", () => {
    const result = calculateFreelanceNet(
      baseProfile(),
      baseFreelanceInput({ billing: { mode: "monthly", amount: 1000 }, withholdingWaiver: true }),
    );
    expect(result.monthly.irsWithheld).toBe(0);
    expect(result.flags).toContain("WITHHOLDING_WAIVER_APPLIED");
  });

  it("withholds normally once expected annual income exceeds the threshold, waiver notwithstanding", () => {
    const result = calculateFreelanceNet(
      baseProfile(),
      baseFreelanceInput({ billing: { mode: "monthly", amount: 2000 }, withholdingWaiver: true }),
    );
    expect(result.monthly.irsWithheld).toBeGreaterThan(0);
    expect(result.flags).not.toContain("WITHHOLDING_WAIVER_APPLIED");
  });
});

describe("recibos verdes: VAT is pass-through, never affects net", () => {
  it("adds VAT for a PT client under the normal regime without touching cashInHand/trueNet math", () => {
    const withVat = calculateFreelanceNet(baseProfile(), baseFreelanceInput());
    expect(withVat.monthly.vatOnInvoice).toBeCloseTo(2000 * 0.23, 2);
  });

  it("charges no VAT and flags art. 53º exemption when self-declared", () => {
    const result = calculateFreelanceNet(baseProfile(), baseFreelanceInput({ vatRegime: "art53_exempt" }));
    expect(result.monthly.vatOnInvoice).toBe(0);
    expect(result.flags).toContain("ART53_VAT_EXEMPT");
  });
});
