import { describe, expect, it } from "vitest";
import { canExtendFocus, elapsedFocusMs, finishFocusSession, preferredFocusMode, selectFocusContext } from "@/lib/focus";
import type { ActiveFocusSession, FocusSession, Task } from "@/lib/types";

const date = "2026-07-23";
const now = new Date("2026-07-23T03:00:00.000Z"); // 10:00 Bangkok
const task = (patch: Partial<Task> & Pick<Task, "id" | "title">): Task => ({
  place: "",
  priority: "normal",
  order: 0,
  done: false,
  ...patch,
});

describe("timeline-aware focus", () => {
  it("selects the currently scheduled task before unscheduled work", () => {
    const current = task({ id: "current", title: "รายงาน", fixedTime: "09:30", durationMin: 90 });
    const context = selectFocusContext([task({ id: "free", title: "อ่าน" }), current], [], date, now);
    expect(context.task?.id).toBe("current");
    expect(context.remainingTaskMin).toBe(60);
  });

  it("does not select completed tasks", () => {
    const context = selectFocusContext([
      task({ id: "done", title: "เสร็จ", done: true, fixedTime: "09:30", durationMin: 90 }),
      task({ id: "free", title: "พร้อม" }),
    ], [], date, now);
    expect(context.task?.id).toBe("free");
  });

  it("selects a startable unscheduled task when no scheduled task is current", () => {
    const context = selectFocusContext([task({ id: "free", title: "อ่าน", order: 1 })], [], date, now);
    expect(context.task?.id).toBe("free");
    expect(context.recommendedMin).toBe(25);
  });

  it("subtracts previous focus time from the task estimate", () => {
    const sessions: FocusSession[] = [{ id: "old", taskId: "free", date, mode: "pomodoro", startedAt: now.toISOString(), plannedMin: 25, actualMin: 20, completed: false }];
    const context = selectFocusContext([task({ id: "free", title: "อ่าน", durationMin: 60 })], sessions, date, now);
    expect(context.remainingTaskMin).toBe(40);
  });

  it("caps smart duration before the next locked task and buffer", () => {
    const context = selectFocusContext([
      task({ id: "free", title: "รายงาน", durationMin: 90 }),
      task({ id: "locked", title: "เรียน", fixedTime: "10:40", durationMin: 60, lockTime: true }),
    ], [], date, now, 10);
    expect(context.recommendedMin).toBe(30);
    expect(context.maxSafeMin).toBe(30);
    expect(context.reason).toContain("10:40");
  });

  it("does not offer a focus window inside the locked-task buffer", () => {
    const context = selectFocusContext([
      task({ id: "free", title: "รายงาน", durationMin: 90 }),
      task({ id: "locked", title: "เรียน", fixedTime: "10:05", durationMin: 60, lockTime: true }),
    ], [], date, now, 10);
    expect(context.recommendedMin).toBe(0);
    expect(context.maxSafeMin).toBe(0);
    expect(context.reason).toContain("ยังไม่มีช่วงโฟกัสที่ปลอดภัย");
  });

  it("reserves trusted travel time before a locked task", () => {
    const context = selectFocusContext([
      task({ id: "free", title: "รายงาน", durationMin: 90 }),
      task({ id: "locked", title: "ประชุม", fixedTime: "11:00", durationMin: 60, travelFromPrevMin: 20, lockTime: true }),
    ], [], date, now, 10);
    expect(context.recommendedMin).toBe(30);
    expect(context.reason).toContain("เดินทาง 20 นาที");
  });

  it("selects a task that continues past midnight from the previous day", () => {
    const afterMidnight = new Date("2026-07-23T17:30:00.000Z"); // 00:30 Bangkok on Jul 24
    const context = selectFocusContext([
      task({ id: "overnight", title: "ทำงานข้ามคืน", occurrenceDate: "2026-07-23", fixedTime: "23:30", durationMin: 120 }),
      task({ id: "later", title: "งานเช้า", occurrenceDate: "2026-07-24", fixedTime: "08:00", durationMin: 60 }),
    ], [], "2026-07-24", afterMidnight);
    expect(context.task?.id).toBe("overnight");
    expect(context.remainingTaskMin).toBe(60);
  });

  it("does not select work from another day", () => {
    expect(selectFocusContext([task({ id: "free", title: "อ่าน" })], [], "2026-07-24", now).task).toBeUndefined();
  });

  it("uses timestamp elapsed time and survives a refresh calculation", () => {
    const active: ActiveFocusSession = { id: "focus", taskId: "free", date, mode: "pomodoro", startedAt: "2026-07-23T02:50:00.000Z", plannedMin: 25, pausedMs: 60_000 };
    expect(elapsedFocusMs(active, now)).toBe(9 * 60_000);
  });

  it("blocks extension that would overlap a locked task", () => {
    const active: ActiveFocusSession = { id: "focus", taskId: "free", date, mode: "pomodoro", startedAt: "2026-07-23T02:50:00.000Z", plannedMin: 25, pausedMs: 0 };
    const result = canExtendFocus(active, [task({ id: "locked", title: "เรียน", fixedTime: "10:25", lockTime: true })], now, 5, 10);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("เรียน");
  });

  it("records actual duration and outcome when finishing", () => {
    const active: ActiveFocusSession = { id: "focus", taskId: "free", date, mode: "remaining_task_time", startedAt: "2026-07-23T02:30:00.000Z", plannedMin: 45, pausedMs: 0 };
    expect(finishFocusSession(active, "completed", now)).toMatchObject({ actualMin: 30, outcome: "completed", completed: true, date });
  });

  it("uses the latest session mode before the settings fallback", () => {
    const sessions: FocusSession[] = [{ id: "old", mode: "custom", startedAt: now.toISOString(), plannedMin: 40, completed: true }];
    expect(preferredFocusMode(sessions, "pomodoro")).toBe("custom");
    expect(preferredFocusMode([], "long")).toBe("long");
  });
});
