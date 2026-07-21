import { describe, expect, it } from "vitest";
import {
  BANGKOK_TIME_ZONE,
  dateKeyInTimeZone,
  getDayStatus,
  getMonthDayStatuses,
  summarizeDayStatuses,
} from "@/lib/day-status";

describe("getDayStatus", () => {
  it("returns empty when the day has no tasks", () => {
    expect(getDayStatus([], "2026-07-21", "2026-07-21")).toBe("empty");
  });

  it("returns completed when every task is done", () => {
    expect(getDayStatus([{ done: true }, { status: "completed" }], "2026-07-21", "2026-07-21")).toBe("completed");
  });

  it("returns pending for current or future days containing unfinished work", () => {
    expect(getDayStatus([{ done: true }, { done: false }], "2026-07-21", "2026-07-21")).toBe("pending");
    expect(getDayStatus([{ done: false }], "2026-07-22", "2026-07-21")).toBe("pending");
  });

  it("returns failed for unfinished work on a past day", () => {
    expect(getDayStatus([{ done: true }, { done: false }], "2026-07-20", "2026-07-21")).toBe("failed");
  });

  it("honors failed over pending and completed in a mixed day", () => {
    expect(getDayStatus([
      { status: "completed" },
      { status: "pending" },
      { status: "failed" },
    ], "2026-07-21", "2026-07-21")).toBe("failed");
  });

  it("honors pending over completed in a mixed day", () => {
    expect(getDayStatus([
      { done: true },
      { status: "pending" },
    ], "2026-07-21", "2026-07-21")).toBe("pending");
  });
});
describe("calendar status helpers", () => {
  it("builds statuses by local date key and summarizes non-empty days", () => {
    const statuses = getMonthDayStatuses({
      "2026-07-01": [{ done: true }],
      "2026-07-02": [{ done: false }],
      "2026-07-20": [{ done: false }],
    }, 2026, 6, "2026-07-10");

    expect(statuses[1]).toBe("completed");
    expect(statuses[2]).toBe("failed");
    expect(statuses[20]).toBe("pending");
    expect(statuses[3]).toBe("empty");
    expect(summarizeDayStatuses(Object.values(statuses))).toEqual({ completed: 1, pending: 1, failed: 1 });
  });

  it("uses the Asia/Bangkok day at the UTC date boundary", () => {
    const instant = new Date("2026-07-20T17:30:00.000Z");
    expect(dateKeyInTimeZone(instant, BANGKOK_TIME_ZONE)).toBe("2026-07-21");
    expect(dateKeyInTimeZone(instant, "UTC")).toBe("2026-07-20");
  });
});
