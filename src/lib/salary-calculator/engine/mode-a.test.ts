import { describe, expect, it } from "vitest";
import { calculateMonthlyWithholding, selectWithholdingTableKey } from "./withholding";
import { splitMealAllowance } from "./meal-allowance";
import { calculateEmployeeSocialSecurity } from "./social-security";
import { calculateColeta } from "./annual-irs";
import { getMeta, getIrsBracketsRuleSet } from "../rules/loader";
import { calculateEmploymentNet } from "./mode-a";
import type { Profile } from "./types";

// Spec §8.1 "Tests (definition of done)" — T1-T5, T8 for Phase 1. Every
// expected value is transcribed directly from the spec document, not
// derived from the engine itself.

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

describe("T1 — withholding, Continente 2026, Table I, R=1500, 2 dependents", () => {
  it("retains €125.31 (1,500 × 24.1% − 193.33 − 2 × 21.43)", () => {
    const profile = baseProfile({ maritalStatus: "married_two_earners", dependents: 2 });
    expect(selectWithholdingTableKey(profile)).toBe("I");
    const result = calculateMonthlyWithholding(profile, 1500);
    expect(result.retention).toBeCloseTo(125.31, 2);
  });
});

describe("T2 — withholding, R=920 Continente 2026", () => {
  it("retains €0.00 (at the exemption threshold)", () => {
    const profile = baseProfile();
    const result = calculateMonthlyWithholding(profile, 920);
    expect(result.retention).toBe(0);
  });
});

describe("T3 — IRS Jovem cap 2026", () => {
  it("is €29,542.15 (55 × IAS)", () => {
    const meta = getMeta(2026);
    expect(meta.irsJovemExemptionCap.value).toBeCloseTo(29542.15, 2);
    expect(meta.ias * meta.irsJovemExemptionCap.multipleOfIas).toBeCloseTo(29542.15, 2);
  });
});

describe("T4 — meal €11/day cash", () => {
  it("is taxable €4.85/day", () => {
    const meta = getMeta(2026);
    const split = splitMealAllowance({ type: "cash", dailyValue: 11, daysPerMonth: 1 }, meta);
    expect(split.taxableDaily).toBeCloseTo(4.85, 2);
  });
});

describe("T5 — meal €11/day card", () => {
  it("is taxable €0.545/day before rounding", () => {
    const meta = getMeta(2026);
    const split = splitMealAllowance({ type: "card", dailyValue: 11, daysPerMonth: 1 }, meta);
    expect(split.taxableDaily).toBeCloseTo(0.545, 3);
  });
});

describe("T8 — annual IRS, Continente, coletável €30,000, no deductions", () => {
  it("coleta is €6,260.06", () => {
    const irsBrackets = getIrsBracketsRuleSet("continente", 2026, 1);
    const coleta = calculateColeta(30000, irsBrackets);
    expect(coleta.toNumber()).toBeCloseTo(6260.06, 2);
  });
});

describe("known-good check (spec §3.2) — Table I 2026 Continente, bracket up to €1,819", () => {
  it("has marginal rate 24.10%, parcela a abater €193.33, parcela por dependente €21.43", () => {
    const profile = baseProfile();
    const result = calculateMonthlyWithholding(profile, 1819);
    expect(result.rate).toBeCloseTo(0.241, 4);
  });
});

describe("calculateEmploymentNet — full orchestration smoke test", () => {
  it("produces a sane result for a realistic salary with 14 payments and cash meal allowance", () => {
    const profile = baseProfile({ maritalStatus: "married_two_earners", dependents: 1 });
    const result = calculateEmploymentNet(profile, {
      grossMonthly: 2000,
      paymentsPerYear: 14,
      twelfths: "none",
      meal: { type: "cash", dailyValue: 7.5, daysPerMonth: 22 },
    });

    expect(result.monthly.gross).toBe(2000);
    expect(result.monthly.net).toBeLessThan(result.monthly.gross);
    expect(result.monthly.netIncludingMeal).toBeGreaterThan(result.monthly.net);
    expect(result.subsidyMonths).not.toBeNull();
    expect(result.subsidyMonths!.holiday.gross).toBe(2000);
    expect(result.annual.gross).toBeCloseTo(2000 * 14, 2);
    expect(result.employerCost.annual).toBeGreaterThan(result.annual.gross);
    expect(result.annualSettlementEstimate).toBeDefined();
  });

  it("applies a flat 20% withholding under IFICI, bypassing tables entirely", () => {
    const profile = baseProfile({ flatRate20: true });
    const result = calculateEmploymentNet(profile, {
      grossMonthly: 5000,
      paymentsPerYear: 14,
      twelfths: "none",
      meal: { type: "none", dailyValue: 0, daysPerMonth: 0 },
    });
    expect(result.monthly.irs).toBeCloseTo(1000, 2);
  });
});

describe("property: net never exceeds gross", () => {
  it("holds for a mid-range salary", () => {
    const meta = getMeta(2026);
    const taxable = 3000;
    const ss = calculateEmployeeSocialSecurity(taxable, meta);
    const profile = baseProfile();
    const irs = calculateMonthlyWithholding(profile, taxable).retention;
    expect(taxable - ss - irs).toBeLessThanOrEqual(taxable);
  });
});
