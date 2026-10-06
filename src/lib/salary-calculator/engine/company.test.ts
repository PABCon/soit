import { describe, expect, it } from "vitest";
import { calculateCompanyNet } from "./company";
import { getMeta } from "../rules/loader";
import type { Profile, CompanyInput } from "./types";

// Spec §8.1 "Tests (definition of done)" — T10 for Phase 4.

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

function baseCompanyInput(overrides: Partial<CompanyInput> = {}): CompanyInput {
  return {
    revenue: { mode: "annual", amount: 80000 },
    clientLocation: "pt",
    gerenteGrossMonthly: 2000,
    gerentePaymentsPerYear: 14,
    operatingExpensesAnnual: 5000,
    accountantMonthly: 100,
    municipalSurchargeRate: 0.015,
    isSME: true,
    distributeAllProfit: true,
    ...overrides,
  };
}

describe("T10: Mode C, gerente salary 0", () => {
  it("still uses IAS × 12 as the SS base", () => {
    const meta = getMeta(2026);
    const result = calculateCompanyNet(baseProfile(), baseCompanyInput({ gerenteGrossMonthly: 0 }));
    const expectedBase = meta.ias * 12;
    expect(result.company.companySs).toBeCloseTo(expectedBase * 0.2375, 2);
    expect(result.company.gerenteMemberSs).toBeCloseTo(expectedBase * 0.11, 2);
  });

  it("is exempt when self-declared as covered by another mandatory SS regime", () => {
    const result = calculateCompanyNet(
      baseProfile(),
      baseCompanyInput({ gerenteGrossMonthly: 0, gerenteExemptViaOtherActivity: true }),
    );
    expect(result.company.companySs).toBe(0);
    expect(result.company.gerenteMemberSs).toBe(0);
  });
});

describe("Mode C: IRC brackets and dividend tax", () => {
  it("applies 15%/19% SME brackets, 28% liberatory dividend tax", () => {
    const result = calculateCompanyNet(baseProfile(), baseCompanyInput({ revenue: { mode: "annual", amount: 150000 } }));
    expect(result.company.profitBeforeTax).toBeGreaterThan(50000);
    // IRC = 15% × 50,000 + 19% × (profit - 50,000).
    const expectedIrc = 50000 * 0.15 + (result.company.profitBeforeTax - 50000) * 0.19;
    expect(result.company.irc).toBeCloseTo(expectedIrc, 2);
    expect(result.person.dividendsNet).toBeCloseTo(result.person.dividendsGross * 0.72, 2);
  });

  it("takeHome combines the gerente's net salary and net dividends", () => {
    const result = calculateCompanyNet(baseProfile(), baseCompanyInput());
    expect(result.person.takeHomeAnnual).toBeCloseTo(
      result.person.gerenteNetSalary + result.person.dividendsNet,
      2,
    );
  });

  it("distributes nothing when distributeAllProfit is false", () => {
    const result = calculateCompanyNet(baseProfile(), baseCompanyInput({ distributeAllProfit: false }));
    expect(result.person.dividendsGross).toBe(0);
    expect(result.person.dividendsNet).toBe(0);
  });
});
