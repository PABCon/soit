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

describe("sortForFeed", () => {
  it("still places Top Employer jobs first, unaffected by salary visibility", () => {
    const hiddenSalaryTopEmployer = makeRow({
      id: "a",
      companies: { top_employer_active: true },
      salary_public: false,
    });
    const visibleSalaryRegular = makeRow({ id: "b", salary_public: true });
    const sorted = sortForFeed([visibleSalaryRegular, hiddenSalaryTopEmployer]);
    expect(sorted.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("growth-plan fix: within the same tier, a salary-visible job ranks above a hidden one", () => {
    const hidden = makeRow({ id: "hidden", salary_public: false, boost_rank_at: "2026-11-01T00:00:00Z" });
    const visible = makeRow({ id: "visible", salary_public: true, boost_rank_at: "2026-10-01T00:00:00Z" });
    // Even though `hidden` has a more recent boost_rank_at, salary
    // visibility is checked first — the whole point of the fix.
    const sorted = sortForFeed([hidden, visible]);
    expect(sorted.map((r) => r.id)).toEqual(["visible", "hidden"]);
  });

  it("never disadvantages the free-tier majority, who always have salary_public: true", () => {
    const freeTierA = makeRow({ id: "a", salary_public: true, boost_rank_at: "2026-10-01T00:00:00Z" });
    const freeTierB = makeRow({ id: "b", salary_public: true, boost_rank_at: "2026-11-01T00:00:00Z" });
    // Both visible — falls through to the existing boost_rank_at tie-break, unchanged.
    const sorted = sortForFeed([freeTierA, freeTierB]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
