import { describe, expect, it } from "vitest";
import { findScheduleOverlaps, scheduleDurationMin, validatePlanTaskCoverage } from "@/lib/schedule-validation";
import type { PlanResult, ScheduleItem, Task } from "@/lib/types";

const item = (taskId: string, start: string, end: string): ScheduleItem => ({
  taskId,
  title: taskId,
  placeLabel: "",
  start,
  end,
  travelFromPrevMin: 0,
});
describe("schedule validation", () => {
  it("does not report adjacent items as overlapping", () => {
    expect(findScheduleOverlaps([item("a", "09:00", "10:00"), item("b", "10:00", "11:00")])).toEqual([]);
  });

  it("reports the exact overlap", () => {
    expect(findScheduleOverlaps([item("a", "09:00", "10:30"), item("b", "10:00", "11:00")])).toMatchObject([
      { firstTaskId: "a", secondTaskId: "b", overlapMin: 30, start: "10:00", end: "10:30" },
    ]);
  });

  it("calculates duration across midnight", () => {
    expect(scheduleDurationMin("23:30", "01:00")).toBe(90);
  });

  it("detects a missing original task in either plan", () => {
    const variant = { schedule: [item("a", "09:00", "10:00")], controlScore: 80, freeTimeMin: 60, riskScore: 0, riskPoints: [] };
    const plan: PlanResult = { plans: { A: variant, B: variant }, summary: "", tip: "", mode: "ai" };
    const tasks: Task[] = [
      { id: "a", title: "A", place: "", priority: "normal" },
      { id: "b", title: "B", place: "", priority: "normal" },
    ];
    expect(validatePlanTaskCoverage(plan, tasks)).toEqual(["A:missing:b", "B:missing:b"]);
  });
});
