import { describe, expect, it } from "vitest";
import { parseJobFilterParams, serializeJobFilterParams, jobMatchesFilters, monthlyFloor } from "./match-filters";
import type { Job } from "@/lib/types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "1",
    slug: "test-job",
    title: "Senior Backend Engineer",
    company: { slug: "acme", name: "Acme" },
    location: "Lisboa",
    locationSlug: "lisboa",
    locationCountry: "Portugal",
    lat: null,
    lng: null,
    workModel: "remote",
    seniority: "senior",
    tech: ["react"],
    categorySlug: "backend-development",
    requiredLanguageSlugs: [],
    salaryMin: 2500,
    salaryMax: 3500,
    salaryPeriod: "month",
    salaryBasis: "gross",
    contractSalaries: [],
    employmentType: "permanent",
    employmentTypes: ["permanent"],
    language: "en",
    postedDaysAgo: 1,
    daysLeft: 29,
    isTopEmployer: false,
    isBoosted: false,
    ...overrides,
  };
}

describe("parseJobFilterParams", () => {
  it("bug fix regression: a salary+remote-only search with no keyword is a real, non-empty filter set", () => {
    const params = new URLSearchParams({ minSalary: "2000", remote: "1" });
    const filters = parseJobFilterParams(params);
    expect(filters.minSalary).toBe(2000);
    expect(filters.remoteOnly).toBe(true);
    expect(filters.q).toBe("");
  });
});

describe("serializeJobFilterParams", () => {
  it("round-trips through parseJobFilterParams unchanged", () => {
    const original = parseJobFilterParams(
      new URLSearchParams({
        q: "backend",
        near: "lisboa",
        radiusKm: "25",
        tech: "React,Python",
        cat: "backend-development",
        seniority: "senior,lead",
        workModel: "remote",
        empType: "permanent",
        reqLang: "english",
        remote: "1",
        minSalary: "2500",
      }),
    );
    const roundTripped = parseJobFilterParams(serializeJobFilterParams(original));
    expect(roundTripped).toEqual(original);
  });

  it("omits every empty/default field rather than writing a param with no real value", () => {
    const params = serializeJobFilterParams(parseJobFilterParams(new URLSearchParams()));
    expect(params.toString()).toBe("");
  });
});

describe("jobMatchesFilters", () => {
  it("matches a job against salary floor + remote-only with no keyword at all — the exact reported bug", () => {
    const params = new URLSearchParams({ minSalary: "2000", remote: "1" });
    const filters = parseJobFilterParams(params);
    expect(jobMatchesFilters(makeJob({ workModel: "remote", salaryMin: 2500 }), filters, null)).toBe(true);
    expect(jobMatchesFilters(makeJob({ workModel: "office", salaryMin: 2500 }), filters, null)).toBe(false);
    expect(jobMatchesFilters(makeJob({ workModel: "remote", salaryMin: 1500 }), filters, null)).toBe(false);
  });

  it("never excludes a job with a hidden salary from a minSalary filter", () => {
    const params = new URLSearchParams({ minSalary: "5000" });
    const filters = parseJobFilterParams(params);
    expect(jobMatchesFilters(makeJob({ salaryMin: null }), filters, null)).toBe(true);
  });

  it("still matches on keyword alone, unchanged from before", () => {
    const params = new URLSearchParams({ q: "backend" });
    const filters = parseJobFilterParams(params);
    expect(jobMatchesFilters(makeJob({ title: "Backend Engineer" }), filters, null)).toBe(true);
    expect(jobMatchesFilters(makeJob({ title: "Frontend Engineer" }), filters, null)).toBe(false);
  });
});

describe("monthlyFloor", () => {
  it("normalizes every billing period onto a monthly-gross scale", () => {
    expect(monthlyFloor({ salaryMin: 2500, salaryPeriod: "month" })).toBe(2500);
    expect(monthlyFloor({ salaryMin: 30000, salaryPeriod: "year" })).toBe(2500);
    expect(monthlyFloor({ salaryMin: 100, salaryPeriod: "day" })).toBe(2100);
    expect(monthlyFloor({ salaryMin: null, salaryPeriod: "month" })).toBeNull();
  });
});
