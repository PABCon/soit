import { describe, it, expect } from "vitest";
import { scoreJobMatch, MIN_MATCH_SCORE, type JobFactsForScoring, type CandidatePrefsForScoring } from "./matching-scoring";

const LISBON = "loc-lisbon";
const WARSAW = "loc-warsaw";
const SQL_TAG = "tag-sql";
const LINUX_TAG = "tag-linux";
const REST_TAG = "tag-rest";

function job(overrides: Partial<JobFactsForScoring> = {}): JobFactsForScoring {
  return {
    categoryId: null,
    locationId: LISBON,
    workModel: "hybrid",
    employmentType: "permanent",
    salaryMin: 2000,
    salaryMax: 3000,
    salaryPeriod: "month",
    ...overrides,
  };
}

function prefs(overrides: Partial<NonNullable<CandidatePrefsForScoring>> = {}): CandidatePrefsForScoring {
  return {
    categoryIds: [],
    locationIds: [],
    workModel: null,
    employmentType: null,
    salaryMin: null,
    salaryMax: null,
    salaryPeriod: null,
    residenceLocationId: null,
    ...overrides,
  };
}

describe("scoreJobMatch", () => {
  it("regression: a thin-tagged job + zero candidate preferences no longer clears threshold", () => {
    // Reconstructs the real false positive found live: "Senior Oracle HCM
    // Developer" tagged only SQL as required, candidate has SQL and has
    // set literally no preferences at all. Before the fix this scored
    // 90 (60 skill + a free flat 15, doubled by the old hybrid/permanent
    // default-matching quirk); the real bug was the free neutral, not
    // the hybrid/permanent coincidence, so this fixture deliberately
    // avoids relying on any prefs being set at all.
    const score = scoreJobMatch(
      job({ workModel: "remote" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs(),
    );
    expect(score).toBeLessThan(MIN_MATCH_SCORE);
    expect(score).toBe(60); // skill bucket only, zero preference points
  });

  it("a known residence that matches the job's city scores normally", () => {
    const score = scoreJobMatch(
      job({ locationId: LISBON, workModel: "office" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ residenceLocationId: LISBON }),
    );
    expect(score).toBe(60);
  });

  it("a known residence that mismatches an on-site job is a hard 0, regardless of skill overlap", () => {
    const score = scoreJobMatch(
      job({ locationId: LISBON, workModel: "office" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ residenceLocationId: WARSAW, categoryIds: ["cat-1"] }),
    );
    expect(score).toBe(0);
  });

  it("a known residence that mismatches a hybrid job is also a hard 0", () => {
    const score = scoreJobMatch(
      job({ locationId: LISBON, workModel: "hybrid" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ residenceLocationId: WARSAW }),
    );
    expect(score).toBe(0);
  });

  it("a residence mismatch never penalizes a fully remote job", () => {
    const score = scoreJobMatch(
      job({ locationId: LISBON, workModel: "remote" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ residenceLocationId: WARSAW }),
    );
    expect(score).toBe(60);
  });

  it("an unknown (null) residence never blocks an on-site job — stays neutral, not penalized", () => {
    const score = scoreJobMatch(
      job({ locationId: LISBON, workModel: "office" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ residenceLocationId: null }),
    );
    expect(score).toBe(60);
  });

  it("real preferences still earn real preference points (not broken by the neutral-default fix)", () => {
    const score = scoreJobMatch(
      job({ workModel: "remote", employmentType: "permanent" }),
      [{ techTagId: SQL_TAG, required: true }, { techTagId: LINUX_TAG, required: true }, { techTagId: REST_TAG, required: true }],
      new Set([SQL_TAG, REST_TAG]),
      prefs({ workModel: "remote", employmentType: "permanent" }),
    );
    // 2/3 required skills = 40, plus full preference bucket (workModel +
    // employmentType both set and both match) = 30 → 70.
    expect(score).toBe(70);
  });

  it("partially-matching preferences score proportionally, not all-or-nothing", () => {
    const score = scoreJobMatch(
      job({ workModel: "remote", employmentType: "freelance" }),
      [{ techTagId: SQL_TAG, required: true }],
      new Set([SQL_TAG]),
      prefs({ workModel: "remote", employmentType: "permanent" }), // employmentType set but doesn't match
    );
    // 60 skill + (workModel matches: 5 / 10 weight) * 30 = 60 + 15 = 75
    expect(score).toBe(75);
  });
});
