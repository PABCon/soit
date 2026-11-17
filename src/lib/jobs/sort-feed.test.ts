import { describe, expect, it } from "vitest";
import { sortForFeed, type FeedSortableJob } from "@/lib/jobs/sort-feed";

type TestRow = FeedSortableJob & { id: string };

function makeRow(overrides: Partial<TestRow> & { id: string }): TestRow {
  return {
    companies: { top_employer_active: false },
    salary_public: true,
    boost_rank_at: null,
    ...overrides,
  };
}

describe("sortForFeed — growth-phase default (topEmployerFirst off)", () => {
  it("ranks purely by boost_rank_at, ignoring Top Employer status", () => {
    const topEmployerOlder = makeRow({
      id: "topEmployer",
      companies: { top_employer_active: true },
      boost_rank_at: "2026-10-01T00:00:00Z",
    });
    const regularNewer = makeRow({ id: "regular", boost_rank_at: "2026-11-01T00:00:00Z" });
    // No second argument — exercises the actual default the app calls today.
    const sorted = sortForFeed([topEmployerOlder, regularNewer]);
    expect(sorted.map((r) => r.id)).toEqual(["regular", "topEmployer"]);
  });

  it("ranks purely by boost_rank_at, ignoring salary visibility", () => {
    const hiddenNewer = makeRow({ id: "hidden", salary_public: false, boost_rank_at: "2026-11-01T00:00:00Z" });
    const visibleOlder = makeRow({ id: "visible", salary_public: true, boost_rank_at: "2026-10-01T00:00:00Z" });
    const sorted = sortForFeed([hiddenNewer, visibleOlder]);
    expect(sorted.map((r) => r.id)).toEqual(["hidden", "visible"]);
  });
});

// The original always-first-for-paying-customers behavior, kept exercised
// via the explicit `topEmployerFirst: true` override rather than deleted —
// this is exactly what flipping `TOP_EMPLOYER_FIRST` back on re-enables,
// so it stays proven correct while switched off by default.
describe("sortForFeed — topEmployerFirst: true (the pre-growth-phase behavior)", () => {
  it("places Top Employer jobs first, unaffected by salary visibility", () => {
    const hiddenSalaryTopEmployer = makeRow({
      id: "a",
      companies: { top_employer_active: true },
      salary_public: false,
    });
    const visibleSalaryRegular = makeRow({ id: "b", salary_public: true });
    const sorted = sortForFeed([visibleSalaryRegular, hiddenSalaryTopEmployer], true);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("growth-plan fix: within the same tier, a salary-visible job ranks above a hidden one", () => {
    const hidden = makeRow({ id: "hidden", salary_public: false, boost_rank_at: "2026-11-01T00:00:00Z" });
    const visible = makeRow({ id: "visible", salary_public: true, boost_rank_at: "2026-10-01T00:00:00Z" });
    // Even though `hidden` has a more recent boost_rank_at, salary
    // visibility is checked first — the whole point of the fix.
    const sorted = sortForFeed([hidden, visible], true);
    expect(sorted.map((r) => r.id)).toEqual(["visible", "hidden"]);
  });

  it("never disadvantages the free-tier majority, who always have salary_public: true", () => {
    const freeTierA = makeRow({ id: "a", salary_public: true, boost_rank_at: "2026-10-01T00:00:00Z" });
    const freeTierB = makeRow({ id: "b", salary_public: true, boost_rank_at: "2026-11-01T00:00:00Z" });
    // Both visible — falls through to the existing boost_rank_at tie-break, unchanged.
    const sorted = sortForFeed([freeTierA, freeTierB], true);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
