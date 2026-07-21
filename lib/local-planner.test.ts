import { describe, expect, it } from "vitest";
import { buildLocalPlan } from "@/lib/local-planner";
import { findScheduleOverlaps } from "@/lib/schedule-validation";
import { PlanResultSchema, type Task } from "@/lib/types";

describe("deterministic local planner", () => {
  const tasks: Task[] = [
    { id: "flex", title: "เขียนรายงาน", place: "บ้าน", durationMin: 60, priority: "normal", order: 1 },
    { id: "anchor", title: "ประชุม", place: "ออฟฟิศ", fixedTime: "10:00", durationMin: 60, lockTime: true, priority: "high", order: 0 },
    { id: "preferred", title: "โทรศัพท์", place: "", fixedTime: "09:00", durationMin: 60, priority: "normal", order: 2 },
  ];

  it("is schema-valid, deterministic, and preserves every task id exactly once", () => {
    const first = buildLocalPlan(tasks);
    const second = buildLocalPlan(tasks);
    expect(first).toEqual(second);
    expect(() => PlanResultSchema.parse(first)).not.toThrow();
    expect(first.mode).toBe("local");
    for (const name of ["A", "B"] as const) {
      expect(first.plans[name].schedule.map((entry) => entry.taskId).sort()).toEqual(tasks.map((task) => task.id).sort());
      expect(findScheduleOverlaps(first.plans[name].schedule)).toEqual([]);
    }
  });

  it("keeps conflicting locked tasks but reports the conflict honestly", () => {
    const plan = buildLocalPlan([
      { id: "one", title: "หนึ่ง", place: "", fixedTime: "09:00", durationMin: 60, lockTime: true, priority: "high" },
      { id: "two", title: "สอง", place: "", fixedTime: "09:30", durationMin: 60, lockTime: true, priority: "high" },
    ]);
    expect(findScheduleOverlaps(plan.plans.B.schedule)).toHaveLength(1);
    expect(plan.plans.B.riskPoints.some((risk) => risk.reason.includes("ทับกับ"))).toBe(true);
  });

  it("respects day bounds and requested breaks in local mode", () => {
    const plan = buildLocalPlan([
      { id: "one", title: "หนึ่ง", place: "", durationMin: 60, priority: "normal", order: 0 },
      { id: "two", title: "สอง", place: "", durationMin: 60, priority: "normal", order: 1 },
    ], { dayStart: "09:00", dayEnd: "12:00", breakMin: 30 });
    expect(plan.plans.A.schedule.map((item) => item.start)).toEqual(["09:00", "10:30"]);
    expect(plan.plans.A.riskPoints).toEqual([]);
  });
});
