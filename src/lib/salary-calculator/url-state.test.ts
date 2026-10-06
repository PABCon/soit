import { describe, expect, it } from "vitest";
import { encodeState, decodeState } from "./url-state";
import type { SalaryCalculatorState } from "./url-state";

const state: SalaryCalculatorState = {
  mode: "employment",
  profile: {
    year: 2026,
    month: 1,
    region: "continente",
    maritalStatus: "married_two_earners",
    dependents: 2,
    dependentsUnder3: 1,
    dependentsWithDisability: 0,
    disabilityAbove60: false,
    spouseHasDisability: false,
    age: 29,
    irsJovem: { enabled: true, benefitYear: 2 },
    flatRate20: false,
  },
  employmentInput: {
    grossMonthly: 2500,
    paymentsPerYear: 14,
    twelfths: "none",
    meal: { type: "card", dailyValue: 7.63, daysPerMonth: 22 },
  },
  freelanceInput: {
    billing: { mode: "monthly", amount: 2000 },
    activityType: "other_services",
    clientLocation: "pt",
    monthsSinceStart: 24,
    yearOfActivity: 3,
    alsoEmployed: false,
    declaredExpenses: 0,
    vatRegime: "normal",
    withholdingWaiver: false,
  },
  companyInput: {
    revenueAnnual: 80000,
    clientLocation: "pt",
    gerenteGrossMonthly: 2000,
    gerentePaymentsPerYear: 14,
    operatingExpensesAnnual: 5000,
    accountantMonthly: 100,
    municipalSurchargeRate: 0.015,
    isSME: true,
    distributeAllProfit: true,
  },
};

describe("url-state round-trip (spec §10 — no email/personal data in it)", () => {
  it("decodes back to the exact same state", () => {
    const encoded = encodeState(state);
    expect(encoded).not.toMatch(/[+/=]/); // url-safe
    const decoded = decodeState(encoded);
    expect(decoded).toEqual(state);
  });

  it("returns null for garbage input rather than throwing", () => {
    expect(decodeState("not valid base64 json at all!!")).toBeNull();
  });
});
