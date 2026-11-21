import { describe, it, expect } from "vitest";
import { bucketAssistantEventsByDay } from "./assistant-analytics";

const NOW = new Date("2026-11-11T12:00:00.000Z");

describe("bucketAssistantEventsByDay", () => {
  it("returns exactly `days` points, oldest first, zero-filled when there are no events at all", () => {
    const points = bucketAssistantEventsByDay([], 3, NOW);
    expect(points).toEqual([
      { date: "2026-11-09", messages: 0, searches: 0 },
      { date: "2026-11-10", messages: 0, searches: 0 },
      { date: "2026-11-11", messages: 0, searches: 0 },
    ]);
  });

  it("counts a message_sent event on its own calendar day, never bleeding into a neighboring day", () => {
    const points = bucketAssistantEventsByDay(
      [{ type: "assistant.message_sent", created_at: "2026-11-10T23:59:59.000Z" }],
      3,
      NOW,
    );
    expect(points.find((p) => p.date === "2026-11-10")?.messages).toBe(1);
    expect(points.find((p) => p.date === "2026-11-09")?.messages).toBe(0);
    expect(points.find((p) => p.date === "2026-11-11")?.messages).toBe(0);
  });

  it("counts message_sent and search_performed independently on the same day", () => {
    const points = bucketAssistantEventsByDay(
      [
        { type: "assistant.message_sent", created_at: "2026-11-11T08:00:00.000Z" },
        { type: "assistant.message_sent", created_at: "2026-11-11T09:00:00.000Z" },
        { type: "assistant.search_performed", created_at: "2026-11-11T09:30:00.000Z" },
      ],
      1,
      NOW,
    );
    expect(points).toEqual([{ date: "2026-11-11", messages: 2, searches: 1 }]);
  });

  it("silently drops an event older than the requested window rather than erroring or creating an extra point", () => {
    const points = bucketAssistantEventsByDay(
      [{ type: "assistant.message_sent", created_at: "2026-01-01T00:00:00.000Z" }],
      3,
      NOW,
    );
    expect(points).toHaveLength(3);
    expect(points.reduce((sum, p) => sum + p.messages, 0)).toBe(0);
  });

  it("ignores an unrecognized event type instead of miscounting it as a message", () => {
    const points = bucketAssistantEventsByDay([{ type: "job.viewed", created_at: "2026-11-11T10:00:00.000Z" }], 1, NOW);
    expect(points).toEqual([{ date: "2026-11-11", messages: 0, searches: 0 }]);
  });

  it("never generates a day before trackingStartedAt, rather than zero-filling it", () => {
    const points = bucketAssistantEventsByDay([], 5, NOW, new Date("2026-11-10T00:00:00.000Z"));
    expect(points).toEqual([
      { date: "2026-11-10", messages: 0, searches: 0 },
      { date: "2026-11-11", messages: 0, searches: 0 },
    ]);
  });

  it("ignores trackingStartedAt when it falls before the requested window entirely", () => {
    const points = bucketAssistantEventsByDay([], 3, NOW, new Date("2026-01-01T00:00:00.000Z"));
    expect(points).toHaveLength(3);
  });
});
