import { describe, it, expect } from "vitest";
import { bucketEventsByDay } from "./job-analytics";

const NOW = new Date("2026-11-09T12:00:00.000Z");

describe("bucketEventsByDay", () => {
  it("returns exactly `days` points, oldest first, zero-filled when there are no events at all", () => {
    const points = bucketEventsByDay([], 3, NOW);
    expect(points).toEqual([
      { date: "2026-11-07", views: 0, applyClicks: 0 },
      { date: "2026-11-08", views: 0, applyClicks: 0 },
      { date: "2026-11-09", views: 0, applyClicks: 0 },
    ]);
  });

  it("counts a job.viewed event on its own calendar day, never bleeding into a neighboring day", () => {
    const points = bucketEventsByDay(
      [{ type: "job.viewed", created_at: "2026-11-08T23:59:59.000Z" }],
      3,
      NOW,
    );
    expect(points.find((p) => p.date === "2026-11-08")?.views).toBe(1);
    expect(points.find((p) => p.date === "2026-11-07")?.views).toBe(0);
    expect(points.find((p) => p.date === "2026-11-09")?.views).toBe(0);
  });

  it("counts job.viewed and job.apply_clicked independently on the same day", () => {
    const points = bucketEventsByDay(
      [
        { type: "job.viewed", created_at: "2026-11-09T08:00:00.000Z" },
        { type: "job.viewed", created_at: "2026-11-09T09:00:00.000Z" },
        { type: "job.apply_clicked", created_at: "2026-11-09T10:00:00.000Z" },
      ],
      1,
      NOW,
    );
    expect(points).toEqual([{ date: "2026-11-09", views: 2, applyClicks: 1 }]);
  });

  it("silently drops an event older than the requested window rather than erroring or creating an extra point", () => {
    const points = bucketEventsByDay(
      [{ type: "job.viewed", created_at: "2026-01-01T00:00:00.000Z" }],
      3,
      NOW,
    );
    expect(points).toHaveLength(3);
    expect(points.reduce((sum, p) => sum + p.views, 0)).toBe(0);
  });

  it("ignores an unrecognized event type instead of miscounting it as a view", () => {
    const points = bucketEventsByDay(
      [{ type: "message.sent", created_at: "2026-11-09T10:00:00.000Z" }],
      1,
      NOW,
    );
    expect(points).toEqual([{ date: "2026-11-09", views: 0, applyClicks: 0 }]);
  });
});
