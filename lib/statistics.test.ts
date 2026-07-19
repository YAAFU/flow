import { describe, expect, it } from "vitest";
import { calculateStatistics } from "@/lib/statistics";

describe("statistics", () => {
  it("uses real tasks and focus sessions", () => {
    const result = calculateStatistics({ "2026-07-19": [{ id: "a", title: "A", place: "", priority: "normal", durationMin: 60, done: true }, { id: "b", title: "B", place: "", priority: "normal", durationMin: 30 }] }, [{ id: "f", mode: "free", startedAt: "2026-07-19T02:00:00.000Z", plannedMin: 25, actualMin: 20, completed: true }], "2026-07-19", "2026-07-19", new Date("2026-07-19T12:00:00Z"));
    expect(result).toMatchObject({ total: 2, completed: 1, completionRate: 50, focusMinutes: 20 });
  });
});
