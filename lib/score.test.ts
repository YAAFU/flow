import { describe, it, expect } from "vitest";
import { controlBreakdown, dayLoadHeat, freeTimeMin } from "./score";
import type { ScheduleItem } from "./types";

const day: ScheduleItem[] = [
  { taskId: "a", title: "x", placeLabel: "สยาม", start: "12:00", end: "14:30", travelFromPrevMin: 0 },
  { taskId: "b", title: "y", placeLabel: "บ้าน", start: "19:00", end: "20:00", travelFromPrevMin: 35 },
];

describe("score", () => {
  it("computes busy+travel free time within waking window", () => {
    // window 08:00-24:00 = 960min; busy 150+60=210; travel 35 → free = 960-245 = 715
    expect(freeTimeMin(day)).toBe(715);
  });
  it("heat is 0..1 proportional to busy load", () => {
    const h = dayLoadHeat(day);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThanOrEqual(1);
  });
  it("controlBreakdown is deterministic and explainable", () => {
    const light = controlBreakdown(day, []);
    expect(light.score).toBe(98); // no penalties → capped at 98
    expect(light.parts).toHaveLength(0);
    const risky = controlBreakdown(day, [{ time: "18:00", reason: "รถติด" }]);
    expect(risky.score).toBe(93); // 100 - 7 (one risk point)
  });
  it("more risk points → lower score, parts sum to score", () => {
    const a = controlBreakdown(day, [{ time: "18:00", reason: "x" }]);
    const b = controlBreakdown(day, [{ time: "18:00", reason: "x" }, { time: "20:00", reason: "y" }]);
    expect(b.score).toBeLessThan(a.score);
    expect(a.score).toBe(Math.max(35, Math.min(98, 100 + a.parts.reduce((s, p) => s + p.delta, 0))));
  });
});
