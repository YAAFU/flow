import { describe, expect, it } from "vitest";
import {
  buildTaskFromFormDraft,
  createSubmitGuard,
  deriveCalculatedEndTime,
  estimatedFinish,
  isTaskTitleValid,
  taskToFormDraft,
  validateDuration,
  validateStartTime,
  validateTaskFormDraft,
} from "@/lib/task-form";
import type { Task } from "@/lib/types";

describe("task form rules", () => {
  it("requires a non-whitespace title", () => {
    expect(isTaskTitleValid("   ")).toBe(false);
    expect(isTaskTitleValid("  ประชุมทีม  ")).toBe(true);
  });

  it("allows an unspecified duration and validates custom values", () => {
    expect(validateDuration(false, 0, 0)).toEqual({});
    expect(validateDuration(true, 0, 0).error).toBeTruthy();
    expect(validateDuration(true, -1, 0).error).toBeTruthy();
    expect(validateDuration(true, 1, 60).error).toBeTruthy();
    expect(validateDuration(true, 1, 0)).toEqual({ durationMin: 60 });
    expect(validateDuration(true, 4, 0)).toEqual({ durationMin: 240 });
  });

  it("allows AI scheduling or requires a valid manual start time", () => {
    expect(validateStartTime(false, "")).toEqual({});
    expect(validateStartTime(true, "").error).toBeTruthy();
    expect(validateStartTime(true, "25:00").error).toBeTruthy();
    expect(validateStartTime(true, "13:00")).toEqual({ fixedTime: "13:00" });
  });

  it("shows an estimated finish across midnight", () => {
    expect(estimatedFinish("23:30", 60)).toBe("วันถัดไป 00:30");
    expect(deriveCalculatedEndTime("13:00", 120)).toEqual({ time: "15:00", dayOffset: 0, label: "15:00" });
    expect(deriveCalculatedEndTime("23:30", 60)).toEqual({ time: "00:30", dayOffset: 1, label: "วันถัดไป 00:30" });
    expect(deriveCalculatedEndTime("invalid", 60)).toBeUndefined();
  });

  it("keeps start and duration unset when AI should estimate them", () => {
    const draft = taskToFormDraft();
    draft.title = "เขียนรายงาน";
    const result = validateTaskFormDraft(draft);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.value.fields.fixedTime).toBeUndefined();
    expect(result.value.fields.durationMin).toBeUndefined();
    expect(result.value.fields.lockTime).toBe(false);
  });

  it("builds start plus duration and only locks a real start time", () => {
    const draft = taskToFormDraft();
    Object.assign(draft, {
      title: "ประชุมทีม",
      timeSet: true,
      time: "13:00",
      lockTime: true,
      durationSet: true,
      durationHours: 2,
      durationMinutes: 0,
    });
    const { task } = buildTaskFromFormDraft(draft, {
      order: 2,
      now: new Date("2026-07-21T01:00:00.000Z"),
      additionalFields: { place: "ออฟฟิศ" },
    });
    expect(task).toMatchObject({ title: "ประชุมทีม", place: "ออฟฟิศ", fixedTime: "13:00", durationMin: 120, lockTime: true, order: 2 });

    draft.timeSet = false;
    expect(buildTaskFromFormDraft(draft).task).toMatchObject({ fixedTime: undefined, lockTime: false, durationMin: 120 });
  });

  it("preserves task identity and creation time while editing", () => {
    const editing: Task = {
      id: "task-existing",
      title: "ชื่อเดิม",
      place: "บ้าน",
      priority: "high",
      createdAt: "2026-07-20T01:00:00.000Z",
      updatedAt: "2026-07-20T02:00:00.000Z",
    };
    const draft = taskToFormDraft(editing);
    draft.title = "ชื่อใหม่";
    const { task } = buildTaskFromFormDraft(draft, { editing, now: new Date("2026-07-21T03:00:00.000Z") });
    expect(task).toMatchObject({
      id: "task-existing",
      title: "ชื่อใหม่",
      place: "บ้าน",
      createdAt: "2026-07-20T01:00:00.000Z",
      updatedAt: "2026-07-21T03:00:00.000Z",
    });
  });

  it("blocks repeated submissions until an explicit retry", () => {
    const guard = createSubmitGuard();
    expect(guard.tryLock()).toBe(true);
    expect(guard.tryLock()).toBe(false);
    guard.release();
    expect(guard.tryLock()).toBe(true);
  });
});
