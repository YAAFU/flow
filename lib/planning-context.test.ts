import { describe, expect, it, vi } from "vitest";
import { normalizePlanningContext, planningContextForModel } from "@/lib/planning-context";
import {
  buildPlanningPrompt,
  buildTravelPlanningContext,
  reconcilePlanTravel,
  travelAccuracyWarning,
  validateLockedPlan,
} from "@/lib/planning-route";
import type { PlanResult } from "@/lib/types";

function context() {
  return normalizePlanningContext({
    date: "2026-07-21",
    timezone: "Asia/Bangkok",
    energyLevel: "low",
    startLocation: {
      name: "สยาม",
      latitude: 12.345678,
      longitude: 98.765432,
      source: "search",
      accuracy: 4,
      capturedAt: "2026-07-21T01:00:00.000Z",
    },
    tasks: [{
      id: "locked",
      title: "ประชุม",
      place: "ออฟฟิศ",
      lat: 13.123456,
      lng: 100.654321,
      locationSource: "live",
      locationAccuracy: 3,
      locationCapturedAt: "2026-07-21T01:05:00.000Z",
      privateIntegrationMetadata: { rawCoordinateBackup: "do-not-send" },
      fixedTime: "10:00",
      durationMin: 60,
      lockTime: true,
      priority: "high",
    }],
    lockedTimes: [],
  });
}

describe("planning context", () => {
  it("derives stored task locks and strips precise location fields from the provider projection", () => {
    const parsed = context();
    expect(parsed.lockedTimes).toEqual([{ taskId: "locked", startTime: "10:00", durationMin: 60 }]);

    const projected = planningContextForModel(parsed);
    expect(projected).toMatchObject({ date: "2026-07-21", timezone: "Asia/Bangkok", energyLevel: "low" });
    expect(projected.tasks[0]).not.toHaveProperty("lat");
    expect(projected.tasks[0]).not.toHaveProperty("lng");
    expect(projected.tasks[0]).not.toHaveProperty("locationSource");
    expect(projected.tasks[0]).not.toHaveProperty("locationAccuracy");
    expect(projected.tasks[0]).not.toHaveProperty("locationCapturedAt");
    expect(projected.tasks[0]).not.toHaveProperty("privateIntegrationMetadata");
    expect(projected.startLocation).toEqual({ name: "สยาม", source: "search" });
  });

  it("puts the origin first in a real matrix and discards fallback estimates", async () => {
    const parsed = context();
    const realTable = vi.fn(async () => ({ durations: [[0, 12], [12, 0]], fallback: false }));
    const available = await buildTravelPlanningContext(parsed, realTable);
    expect(realTable).toHaveBeenCalledWith([
      { lat: 12.345678, lng: 98.765432 },
      { lat: 13.123456, lng: 100.654321 },
    ]);
    expect(available.nodes[0]).toMatchObject({ index: 0, kind: "origin", label: "สยาม" });
    expect(available.durationsMin).toEqual([[0, 12], [12, 0]]);

    const fallback = await buildTravelPlanningContext(parsed, async () => ({ durations: [[0, 999], [999, 0]], fallback: true }));
    expect(fallback).toMatchObject({ status: "unavailable", reason: "route_service_unavailable" });
    expect(fallback).not.toHaveProperty("durationsMin");
  });

  it("builds structured prompt data without raw coordinates or accuracy", async () => {
    const parsed = context();
    const travel = await buildTravelPlanningContext(parsed, async () => ({ durations: [[0, 12], [12, 0]], fallback: false }));
    const prompt = buildPlanningPrompt(parsed, travel, { dayStart: "08:00", dayEnd: "18:00", breakMin: 30 });

    expect(prompt).toContain('"date":"2026-07-21"');
    expect(prompt).toContain('"timezone":"Asia/Bangkok"');
    expect(prompt).toContain('"energyLevel":"low"');
    expect(prompt).not.toContain("12.345678");
    expect(prompt).not.toContain("98.765432");
    expect(prompt).not.toContain("13.123456");
    expect(prompt).not.toContain("locationAccuracy");
    expect(prompt).not.toContain("locationCapturedAt");
  });

  it("detects an AI plan that moves or stretches a locked task", () => {
    const variant = {
      schedule: [{ taskId: "locked", title: "ประชุม", placeLabel: "ออฟฟิศ", start: "10:30", end: "12:00", travelFromPrevMin: 0 }],
      controlScore: 80,
      freeTimeMin: 60,
      riskScore: 0,
      riskPoints: [],
    };
    const plan: PlanResult = { plans: { A: variant, B: variant }, summary: "", tip: "", mode: "ai" };
    expect(validateLockedPlan(plan, context())).toEqual([
      "A:moved:locked", "A:duration:locked", "B:moved:locked", "B:duration:locked",
    ]);
  });

  it("keeps a low-accuracy origin warning even when route durations are available", () => {
    const parsed = context();
    parsed.startLocation!.accuracy = 900;
    expect(travelAccuracyWarning(parsed, {
      status: "available",
      originIncluded: true,
      nodes: [],
      durationsMin: [],
    })).toContain("±900 เมตร");
  });

  it("overwrites invented AI travel durations from the trusted matrix in both variants", () => {
    const variantA = {
      schedule: [
        { taskId: "one", title: "งานหนึ่ง", placeLabel: "หนึ่ง", start: "09:00", end: "09:30", travelFromPrevMin: 999 },
        { taskId: "two", title: "งานสอง", placeLabel: "สอง", start: "10:00", end: "10:30", travelFromPrevMin: 888 },
      ],
      controlScore: 80,
      freeTimeMin: 60,
      riskScore: 0,
      riskPoints: [],
    };
    const variantB = {
      ...variantA,
      schedule: [variantA.schedule[1], variantA.schedule[0]],
    };
    const plan: PlanResult = { plans: { A: variantA, B: variantB }, summary: "", tip: "", mode: "ai" };
    const travel = {
      status: "available" as const,
      originIncluded: true,
      nodes: [
        { index: 0, kind: "origin" as const, label: "บ้าน" },
        { index: 1, kind: "task" as const, taskId: "one", label: "หนึ่ง" },
        { index: 2, kind: "task" as const, taskId: "two", label: "สอง" },
      ],
      durationsMin: [[0, 10.4, 20.4], [10.4, 0, 5.4], [20.4, 5.4, 0]],
    };

    const reconciled = reconcilePlanTravel(plan, travel, { dayStart: "08:00" });
    expect(reconciled.plans.A.schedule.map((item) => item.travelFromPrevMin)).toEqual([10, 5]);
    expect(reconciled.plans.B.schedule.map((item) => item.travelFromPrevMin)).toEqual([20, 5]);
    expect(reconciled.plans.A.riskPoints).toEqual([]);
  });

  it("zeros an unresolvable leg and adds an honest nonblocking risk", () => {
    const variant = {
      schedule: [
        { taskId: "locked", title: "ประชุม", placeLabel: "ออฟฟิศ", start: "10:00", end: "11:00", travelFromPrevMin: 12 },
        { taskId: "without-coordinates", title: "โทรหาแม่", placeLabel: "", start: "12:00", end: "12:15", travelFromPrevMin: 45 },
      ],
      controlScore: 80,
      freeTimeMin: 60,
      riskScore: 0,
      riskPoints: [],
    };
    const plan: PlanResult = { plans: { A: variant, B: variant }, summary: "", tip: "", mode: "ai" };
    const reconciled = reconcilePlanTravel(plan, {
      status: "available",
      originIncluded: true,
      nodes: [
        { index: 0, kind: "origin", label: "สยาม" },
        { index: 1, kind: "task", taskId: "locked", label: "ออฟฟิศ" },
      ],
      durationsMin: [[0, 12], [12, 0]],
    });

    for (const name of ["A", "B"] as const) {
      expect(reconciled.plans[name].schedule.map((item) => item.travelFromPrevMin)).toEqual([12, 0]);
      expect(reconciled.plans[name].riskPoints).toEqual([
        expect.objectContaining({ time: "12:00", reason: expect.stringContaining("ไม่มีพิกัดหรือข้อมูลเส้นทาง") }),
      ]);
    }
  });

  it("adds an arrival risk when the trusted route cannot fit before the scheduled start", () => {
    const variant = {
      schedule: [
        { taskId: "locked", title: "ประชุม", placeLabel: "ออฟฟิศ", start: "08:05", end: "09:05", travelFromPrevMin: 0 },
      ],
      controlScore: 80,
      freeTimeMin: 60,
      riskScore: 0,
      riskPoints: [],
    };
    const plan: PlanResult = { plans: { A: variant, B: variant }, summary: "", tip: "", mode: "ai" };
    const reconciled = reconcilePlanTravel(plan, {
      status: "available",
      originIncluded: true,
      nodes: [
        { index: 0, kind: "origin", label: "บ้าน" },
        { index: 1, kind: "task", taskId: "locked", label: "ออฟฟิศ" },
      ],
      durationsMin: [[0, 12], [12, 0]],
    }, { dayStart: "08:00" });

    expect(reconciled.plans.A.schedule[0].travelFromPrevMin).toBe(12);
    expect(reconciled.plans.A.riskPoints).toEqual([
      expect.objectContaining({ reason: expect.stringContaining("มีเวลาเดินทาง 5 นาที") }),
    ]);
    expect(reconciled.plans.B.riskPoints).toHaveLength(1);
  });
});
