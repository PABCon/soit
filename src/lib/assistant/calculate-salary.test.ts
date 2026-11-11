import { describe, expect, it } from "vitest";
import { calculateSalary } from "./calculate-salary";
import { calculateEmploymentNet } from "@/lib/salary-calculator/engine/mode-a";

describe("calculateSalary", () => {
  it("computes employment mode with just grossMonthly, matching the engine called directly with the same defaults", () => {
    const result = calculateSalary({ mode: "employment", grossMonthly: 2500 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const direct = calculateEmploymentNet(
      {
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
      },
      {
        grossMonthly: 2500,
        paymentsPerYear: 14,
        twelfths: "none",
        meal: { type: "card", dailyValue: 10.46, daysPerMonth: 22 },
        exemptAllowanceMonthly: 0,
        irsApplicableAllowanceMonthly: 0,
      },
    );
    expect(result.result).toEqual(direct);
  });

  it("reports missing_fields for employment mode without grossMonthly", () => {
    const result = calculateSalary({ mode: "employment" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["grossMonthly"]);
  });

  it("computes freelance mode with just billingAmount", () => {
    const result = calculateSalary({ mode: "freelance", billingAmount: 3000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toHaveProperty("monthly");
    expect(result.state.freelanceInput.billing.amount).toBe(3000);
  });

  it("reports missing_fields for company mode without gerenteGrossMonthly", () => {
    const result = calculateSalary({ mode: "company", billingAmount: 80000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toEqual(["gerenteGrossMonthly"]);
  });

  it("computes company mode once both required fields are given", () => {
    const result = calculateSalary({ mode: "company", billingAmount: 80000, gerenteGrossMonthly: 2000 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.result).toHaveProperty("person");
  });

  it("carries every mode's input in the returned state, not just the one computed", () => {
    const result = calculateSalary({ mode: "employment", grossMonthly: 2500 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.employmentInput.grossMonthly).toBe(2500);
    expect(result.state.freelanceInput).toBeDefined();
    expect(result.state.companyInput).toBeDefined();
  });
});
