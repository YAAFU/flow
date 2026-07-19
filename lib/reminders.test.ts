import { describe, expect, it, vi } from "vitest";
import { getDueReminders, reminderId } from "@/lib/reminders";
import type { Task } from "@/lib/types";

describe("reminders", () => {
  it("fires in its one-minute window and deduplicates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-19T09:50:30"));
    const task: Task = { id: "t", title: "ประชุม", place: "", priority: "high", fixedTime: "10:00", reminderOffsets: [10] };
    expect(getDueReminders({ "2026-07-19": [task] }, new Date(), new Set())).toHaveLength(1);
    expect(getDueReminders({ "2026-07-19": [task] }, new Date(), new Set([reminderId("t", "2026-07-19", 10)]))).toHaveLength(0);
    vi.useRealTimers();
  });
});
