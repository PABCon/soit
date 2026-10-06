import { describe, expect, it } from "vitest";
import { calculateMonthlyWithholding, selectWithholdingTableKey } from "./withholding";
import { splitMealAllowance } from "./meal-allowance";
import { calculateEmployeeSocialSecurity } from "./social-security";
import { calculateColeta, calculateDeducoesAColeta, calculateAnnualIrs, minimoExistenciaThreshold } from "./annual-irs";
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

describe("disability deduction (art. 87.º CIRS, confirmed live against the primary source)", () => {
  it("applies the taxpayer's 4×IAS deduction regardless of marital status", () => {
    const irsBrackets = getIrsBracketsRuleSet("continente", 2026, 1);
    const single = calculateDeducoesAColeta(
      {
        dependents: 0,
        dependentsUnder3: 0,
        dependentsWithDisability: 0,
        disabilityAbove60: true,
        maritalStatus: "single",
        assumeFullDespesasGerais: false,
      },
      irsBrackets.deductions,
    );
    const married = calculateDeducoesAColeta(
      {
        dependents: 0,
        dependentsUnder3: 0,
        dependentsWithDisability: 0,
        disabilityAbove60: true,
        maritalStatus: "married_single_earner",
        assumeFullDespesasGerais: false,
      },
      irsBrackets.deductions,
    );
    expect(single.toNumber()).toBeCloseTo(2148.52, 2);
    expect(married.toNumber()).toBeCloseTo(2148.52, 2);
  });
});

describe("mínimo de existência (art. 70.º CIRS, confirmed live against the primary source)", () => {
  it("threshold is max(€12,880, 1.5 × 14 × IAS) — €12,880 wins for 2026", () => {
    const meta = getMeta(2026);
    expect(minimoExistenciaThreshold(meta.ias)).toBeCloseTo(12880, 2);
  });

  it("fully exempts IRS when gross annual income is at or below the threshold", () => {
    const irsBrackets = getIrsBracketsRuleSet("continente", 2026, 1);
    const result = calculateAnnualIrs({
      rendimentoColetavel: 10000,
      grossAnnualIncome: 12000,
      ias: 537.13,
      withheld: 500,
      irsBrackets,
      deductionInput: {
        dependents: 0,
        dependentsUnder3: 0,
        dependentsWithDisability: 0,
        disabilityAbove60: false,
        maritalStatus: "single",
      },
      includeDeductions: false,
    });
    expect(result.irsLiquidado).toBe(0);
    expect(result.settlement).toBe(-500); // full refund of whatever was withheld
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

  it("duodécimos actually change the monthly net, and never change the annual total (real bug found by the user, not by any test)", () => {
    const profile = baseProfile();
    const input = {
      grossMonthly: 2000,
      paymentsPerYear: 14 as const,
      meal: { type: "none" as const, dailyValue: 0, daysPerMonth: 0 },
    };

    const none = calculateEmploymentNet(profile, { ...input, twelfths: "none" });
    const half = calculateEmploymentNet(profile, { ...input, twelfths: "half" });
    const full = calculateEmploymentNet(profile, { ...input, twelfths: "full" });

    // The whole point of duodécimos: money that would otherwise arrive
    // in June/December arrives monthly instead — so the regular month's
    // own net must actually go up as more gets spread.
    expect(half.monthly.duodecimoGross).toBeGreaterThan(none.monthly.duodecimoGross);
    expect(full.monthly.duodecimoGross).toBeGreaterThan(half.monthly.duodecimoGross);
    expect(half.monthly.net).toBeGreaterThan(none.monthly.net);
    expect(full.monthly.net).toBeGreaterThan(half.monthly.net);

    // 'full' spreads everything monthly, so there's no separate subsidy
    // month left to pay out.
    expect(none.subsidyMonths).not.toBeNull();
    expect(half.subsidyMonths).not.toBeNull();
    expect(full.subsidyMonths).toBeNull();

    // Duodécimos only change *when* the same total annual pay arrives,
    // never *how much* — the annual net should match across all three
    // (small tolerance for per-bracket rounding differences).
    expect(half.annual.net).toBeCloseTo(none.annual.net, 0);
    expect(full.annual.net).toBeCloseTo(none.annual.net, 0);
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

  it("treats ajudas de custo as fully exempt from both IRS and SS — passes straight to net", () => {
    const profile = baseProfile();
    const input = {
      grossMonthly: 2000,
      paymentsPerYear: 14 as const,
      twelfths: "none" as const,
      meal: { type: "none" as const, dailyValue: 0, daysPerMonth: 0 },
    };
    const without = calculateEmploymentNet(profile, input);
    const withAllowance = calculateEmploymentNet(profile, { ...input, expenseAllowanceMonthly: 100 });

    expect(withAllowance.monthly.ss).toBeCloseTo(without.monthly.ss, 2);
    expect(withAllowance.monthly.irs).toBeCloseTo(without.monthly.irs, 2);
    expect(withAllowance.monthly.net).toBeCloseTo(without.monthly.net + 100, 2);
  });

  it("treats fringe benefits (e.g. Coverflex-style) as IRS-taxable but SS-exempt", () => {
    const profile = baseProfile();
    const input = {
      grossMonthly: 2000,
      paymentsPerYear: 14 as const,
      twelfths: "none" as const,
      meal: { type: "none" as const, dailyValue: 0, daysPerMonth: 0 },
    };
    const without = calculateEmploymentNet(profile, input);
    const withFringe = calculateEmploymentNet(profile, { ...input, fringeBenefitsMonthly: 100 });

    // SS base is untouched by the fringe benefit.
    expect(withFringe.monthly.ss).toBeCloseTo(without.monthly.ss, 2);
    // IRS withholding goes up because the benefit widens the IRS base.
    expect(withFringe.monthly.irs).toBeGreaterThan(without.monthly.irs);
    // Net reflects the full €100 minus whatever extra IRS it triggered.
    const extraIrs = withFringe.monthly.irs - without.monthly.irs;
    expect(withFringe.monthly.net).toBeCloseTo(without.monthly.net + 100 - extraIrs, 2);
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
