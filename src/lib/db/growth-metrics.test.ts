import { describe, it, expect } from "vitest";
import { bucketSignupsByDay } from "./growth-metrics";

const NOW = new Date("2026-11-13T12:00:00.000Z");

describe("bucketSignupsByDay", () => {
  it("returns exactly `days` points, oldest first, zero-filled when there are no signups at all", () => {
    const points = bucketSignupsByDay([], [], 3, NOW);
    expect(points).toEqual([
      { date: "2026-11-11", candidates: 0, companies: 0 },
      { date: "2026-11-12", candidates: 0, companies: 0 },
      { date: "2026-11-13", candidates: 0, companies: 0 },
    ]);
  });

  it("counts a candidate signup on its own calendar day, never bleeding into a neighboring day", () => {
    const points = bucketSignupsByDay(["2026-11-12T23:59:59.000Z"], [], 3, NOW);
    expect(points.find((p) => p.date === "2026-11-12")?.candidates).toBe(1);
    expect(points.find((p) => p.date === "2026-11-11")?.candidates).toBe(0);
    expect(points.find((p) => p.date === "2026-11-13")?.candidates).toBe(0);
  });

  it("counts candidate and company signups independently on the same day", () => {
    const points = bucketSignupsByDay(
      ["2026-11-13T08:00:00.000Z", "2026-11-13T09:00:00.000Z"],
      ["2026-11-13T10:00:00.000Z"],
      1,
      NOW,
    );
    expect(points).toEqual([{ date: "2026-11-13", candidates: 2, companies: 1 }]);
  });

  it("silently drops a signup older than the requested window rather than erroring or creating an extra point", () => {
    const points = bucketSignupsByDay(["2026-10-01T00:00:00.000Z"], [], 3, NOW);
    expect(points.every((p) => p.candidates === 0)).toBe(true);
  });
});
