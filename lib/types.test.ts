import { describe, it, expect } from "vitest";
import { PlanResultSchema, TaskSchema } from "./types";

describe("schemas", () => {
  it("accepts a valid task", () => {
    const t = { id: "1", title: "ออฟฟิศ", place: "สยาม", durationMin: 150, priority: "high" };
    expect(TaskSchema.parse(t).title).toBe("ออฟฟิศ");
  });
  it("rejects a plan whose variant is missing controlScore", () => {
    const variant = { schedule: [], freeTimeMin: 0, riskScore: 1, riskPoints: [] }; // no controlScore
    expect(() => PlanResultSchema.parse({ plans: { A: variant, B: variant }, summary: "x", tip: "y" })).toThrow();
  });
  it("accepts a valid per-variant plan", () => {
    const variant = { schedule: [], controlScore: 70, freeTimeMin: 0, riskScore: 1, riskPoints: [] };
    expect(PlanResultSchema.parse({ plans: { A: variant, B: variant }, summary: "x", tip: "y" }).plans.B.controlScore).toBe(70);
  });
});
