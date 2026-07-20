import { describe, expect, it } from "vitest";
import { createSubmitGuard, estimatedFinish, isTaskTitleValid, validateDuration, validateStartTime } from "@/lib/task-form";

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
  });

  it("blocks repeated submissions until an explicit retry", () => {
    const guard = createSubmitGuard();
    expect(guard.tryLock()).toBe(true);
    expect(guard.tryLock()).toBe(false);
    guard.release();
    expect(guard.tryLock()).toBe(true);
  });
});
