import { describe, expect, it } from "vitest";
import { searchJobs, type SearchJobsVocab } from "./search-jobs";
import type { Job } from "@/lib/types";

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    slug: "job-1",
    title: "Senior Backend Engineer",
    company: { slug: "acme", name: "Acme" },
    location: "Lisboa",
    locationSlug: "lisboa",
    locationCountry: "Portugal",
    lat: 38.7223,
    lng: -9.1393,
    workModel: "remote",
    seniority: "senior",
    tech: ["React", "Node.js"],
    categorySlug: "backend-development",
    requiredLanguageSlugs: ["english"],
    salaryMin: 3000,
    salaryMax: 4000,
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

const VOCAB: SearchJobsVocab = {
  tech: [
    { label: "React", aliases: ["React.js", "ReactJS"] },
    { label: "Python", aliases: [] },
  ],
  categorySlugs: ["backend-development", "data-analytics"],
  languageSlugs: ["english", "portuguese"],
  locations: [{ slug: "lisboa", latitude: 38.7223, longitude: -9.1393 }],
};

describe("searchJobs", () => {
  it("matches a job by a real, exact tech label", () => {
    const jobs = [makeJob({ tech: ["React"] }), makeJob({ id: "job-2", tech: ["Python"] })];
    const result = searchJobs(jobs, { tech: ["React"] }, VOCAB);
    expect(result.count).toBe(1);
    expect(result.jobs[0].id).toBe("job-1");
  });

  it("resolves a real alias to its canonical label before matching", () => {
    const jobs = [makeJob({ tech: ["React"] })];
    const result = searchJobs(jobs, { tech: ["React.js"] }, VOCAB);
    expect(result.count).toBe(1);
  });

  it("silently drops a tech label that doesn't match any real tag, never inventing a filter", () => {
    const jobs = [makeJob(), makeJob({ id: "job-2" })];
    const result = searchJobs(jobs, { tech: ["Cobol-Quantum-Blockchain"] }, VOCAB);
    // No real tech filter applied (the bogus label was dropped), so every job matches.
    expect(result.count).toBe(2);
  });

  it("ignores a category slug that isn't in the real vocabulary", () => {
    const jobs = [makeJob({ categorySlug: "backend-development" })];
    const result = searchJobs(jobs, { categorySlug: "not-a-real-category" }, VOCAB);
    expect(result.count).toBe(1); // category filter dropped, so the job still matches
  });

  it("filters by remote-only", () => {
    const jobs = [makeJob({ workModel: "remote" }), makeJob({ id: "job-2", workModel: "office" })];
    const result = searchJobs(jobs, { remoteOnly: true }, VOCAB);
    expect(result.count).toBe(1);
    expect(result.jobs[0].workModel).toBe("remote");
  });

  it("filters by a real location and radius", () => {
    const jobs = [
      makeJob({ lat: 38.7223, lng: -9.1393 }), // Lisboa itself
      makeJob({ id: "job-2", lat: 41.1579, lng: -8.6291 }), // Porto, ~280km away
    ];
    const result = searchJobs(jobs, { locationSlug: "lisboa", radiusKm: 25 }, VOCAB);
    expect(result.count).toBe(1);
    expect(result.jobs[0].id).toBe("job-1");
  });

  it("ignores an unrecognized location slug rather than erroring", () => {
    const jobs = [makeJob()];
    const result = searchJobs(jobs, { locationSlug: "atlantis" }, VOCAB);
    expect(result.count).toBe(1);
  });

  it("caps results at 6 even when more jobs match", () => {
    const jobs = Array.from({ length: 10 }, (_, i) => makeJob({ id: `job-${i}` }));
    const result = searchJobs(jobs, {}, VOCAB);
    expect(result.count).toBe(10);
    expect(result.jobs).toHaveLength(6);
  });

  it("returns the real, revalidated filters actually used, not the model's raw unvalidated args", () => {
    const jobs = [makeJob({ tech: ["React"] })];
    const result = searchJobs(
      jobs,
      { tech: ["React.js", "madeUpTech"], categorySlug: "not-a-real-category", remoteOnly: true, minSalary: 2000 },
      VOCAB,
    );
    expect(result.filters.tech).toEqual(["React"]); // alias resolved, unmatched dropped
    expect(result.filters.cat).toEqual([]); // invalid category slug dropped
    expect(result.filters.remoteOnly).toBe(true);
    expect(result.filters.minSalary).toBe(2000);
  });
});
