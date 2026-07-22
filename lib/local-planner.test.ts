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
    expect(plan.plans.A.riskPoints.some((risk) => risk.reason.includes("ไม่ได้ระบุจุดเริ่มต้น"))).toBe(true);
    expect(plan.plans.A.riskPoints.some((risk) => risk.reason.includes("อยู่นอกช่วง"))).toBe(false);
  });

  it("adjusts flexible buffers by energy without moving a locked task", () => {
    const energyTasks: Task[] = [
      { id: "one", title: "งานหนึ่ง", place: "", durationMin: 60, priority: "normal", order: 0 },
      { id: "two", title: "งานสอง", place: "", durationMin: 60, priority: "normal", order: 1 },
      { id: "locked", title: "งานล็อก", place: "", fixedTime: "14:00", durationMin: 90, lockTime: true, priority: "high", order: 2 },
    ];
    const low = buildLocalPlan(energyTasks, { dayStart: "09:00", breakMin: 30, energyLevel: "low" });
    const medium = buildLocalPlan(energyTasks, { dayStart: "09:00", breakMin: 30, energyLevel: "medium" });
    const high = buildLocalPlan(energyTasks, { dayStart: "09:00", breakMin: 30, energyLevel: "high" });

    expect(low.plans.A.schedule.find((item) => item.taskId === "two")?.start).toBe("10:45");
    expect(medium.plans.A.schedule.find((item) => item.taskId === "two")?.start).toBe("10:30");
    expect(high.plans.A.schedule.find((item) => item.taskId === "two")?.start).toBe("10:15");
    for (const plan of [low, medium, high]) {
      expect(plan.plans.A.schedule.find((item) => item.taskId === "locked")).toMatchObject({ start: "14:00", end: "15:30" });
    }
  });

  it("uses the origin only to group nearby flexible tasks and never invents travel minutes", () => {
    const plan = buildLocalPlan([
      { id: "far", title: "ไกล", place: "เชียงใหม่", lat: 18.7883, lng: 98.9853, durationMin: 30, priority: "normal", order: 0 },
      { id: "near", title: "ใกล้", place: "สยาม", lat: 13.7466, lng: 100.5347, durationMin: 30, priority: "normal", order: 1 },
    ], {
      dayStart: "09:00",
      energyLevel: "medium",
      startLocation: { name: "จุดเริ่ม", latitude: 13.746, longitude: 100.535, source: "live" },
    });

    expect(plan.plans.A.schedule.map((item) => item.taskId)).toEqual(["near", "far"]);
    expect(plan.plans.A.schedule.every((item) => item.travelFromPrevMin === 0)).toBe(true);
    expect(plan.summary).toContain("ยังไม่รวมเวลาเดินทาง");
    expect(plan.plans.A.riskPoints.some((risk) => risk.reason.includes("ไม่สามารถคำนวณเวลาเส้นทาง"))).toBe(true);
  });

  it("uses an available route matrix to shift an unlocked task instead of only warning", () => {
    const routeTasks: Task[] = [
      { id: "first", title: "งานแรก", place: "สยาม", lat: 13.7466, lng: 100.5347, fixedTime: "09:00", durationMin: 30, priority: "normal" },
      { id: "second", title: "งานสอง", place: "อโศก", lat: 13.738, lng: 100.56, fixedTime: "09:35", durationMin: 30, priority: "normal" },
    ];
    const plan = buildLocalPlan(routeTasks, {
      dayStart: "08:00",
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "บ้าน" },
          { index: 1, kind: "task", taskId: "first", label: "สยาม" },
          { index: 2, kind: "task", taskId: "second", label: "อโศก" },
        ],
        durationsMin: [
          [0, 10, 25],
          [10, 0, 20],
          [25, 20, 0],
        ],
      },
    });

    expect(plan.plans.A.schedule.map((item) => item.travelFromPrevMin)).toEqual([10, 20]);
    expect(plan.plans.A.schedule).toEqual(expect.arrayContaining([
      expect.objectContaining({ taskId: "first", start: "09:00", end: "09:30" }),
      expect.objectContaining({ taskId: "second", start: "09:50", end: "10:20" }),
    ]));
    expect(plan.plans.A.riskPoints.some((risk) => risk.reason.includes("ไปไม่ทัน"))).toBe(false);
    expect(plan.summary).toContain("ใช้เวลาประมาณจากบริการ routing");
    expect(plan.tip).toContain("รวมเวลาประมาณจากจุดเริ่มต้น");
  });

  it("shifts the first unlocked task forward from the selected origin", () => {
    const plan = buildLocalPlan([
      { id: "first", title: "งานแรก", place: "สยาม", lat: 13.7466, lng: 100.5347, fixedTime: "08:00", durationMin: 45, priority: "normal" },
    ], {
      dayStart: "08:00",
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "บ้าน" },
          { index: 1, kind: "task", taskId: "first", label: "สยาม" },
        ],
        durationsMin: [[0, 15], [15, 0]],
      },
    });

    expect(plan.plans.A.schedule[0]).toMatchObject({
      taskId: "first",
      start: "08:15",
      end: "09:00",
      travelFromPrevMin: 15,
    });
  });

  it("preserves a warning when the selected origin has low accuracy", () => {
    const plan = buildLocalPlan([
      { id: "first", title: "งานแรก", place: "สยาม", lat: 13.7466, lng: 100.5347, durationMin: 30, priority: "normal" },
    ], {
      dayStart: "08:00",
      startLocation: { name: "ตำแหน่งปัจจุบัน", latitude: 13.74, longitude: 100.52, source: "live", accuracy: 380 },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "ตำแหน่งปัจจุบัน" },
          { index: 1, kind: "task", taskId: "first", label: "สยาม" },
        ],
        durationsMin: [[0, 10], [10, 0]],
      },
    });

    expect(plan.plans.A.riskPoints).toContainEqual(expect.objectContaining({
      time: "การเดินทาง",
      reason: expect.stringContaining("ความแม่นยำประมาณ 380 เมตร"),
    }));
  });

  it("defers movable work until after a locked task when travel cannot fit before it", () => {
    const plan = buildLocalPlan([
      { id: "first", title: "งานแรก", place: "สยาม", lat: 13.7466, lng: 100.5347, fixedTime: "08:00", durationMin: 30, priority: "normal" },
      { id: "locked", title: "ประชุมล็อกเวลา", place: "อโศก", lat: 13.738, lng: 100.56, fixedTime: "08:40", durationMin: 30, lockTime: true, priority: "high" },
    ], {
      dayStart: "08:00",
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "บ้าน" },
          { index: 1, kind: "task", taskId: "first", label: "สยาม" },
          { index: 2, kind: "task", taskId: "locked", label: "อโศก" },
        ],
        durationsMin: [[0, 10, 25], [10, 0, 20], [25, 20, 0]],
      },
    });

    expect(plan.plans.A.schedule.map((item) => item.taskId)).toEqual(["locked", "first"]);
    expect(plan.plans.A.schedule.find((item) => item.taskId === "locked")).toMatchObject({
      start: "08:40",
      end: "09:10",
      travelFromPrevMin: 25,
    });
    expect(plan.plans.A.schedule.find((item) => item.taskId === "first")).toMatchObject({
      start: "09:30",
      end: "10:00",
      travelFromPrevMin: 20,
    });
    expect(findScheduleOverlaps(plan.plans.A.schedule)).toEqual([]);
    expect(plan.plans.A.riskPoints.some((risk) => risk.reason.includes("ไปไม่ทัน"))).toBe(false);
  });

  it("never moves a locked task when the selected origin itself cannot reach it", () => {
    const plan = buildLocalPlan([
      { id: "locked", title: "ประชุมล็อกเวลา", place: "อโศก", lat: 13.738, lng: 100.56, fixedTime: "08:20", durationMin: 30, lockTime: true, priority: "high" },
    ], {
      dayStart: "08:00",
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "บ้าน" },
          { index: 1, kind: "task", taskId: "locked", label: "อโศก" },
        ],
        durationsMin: [[0, 35], [35, 0]],
      },
    });

    expect(plan.plans.A.schedule[0]).toMatchObject({ start: "08:20", end: "08:50", travelFromPrevMin: 35 });
    expect(plan.plans.A.riskPoints).toContainEqual(expect.objectContaining({
      reason: expect.stringMatching(/ล็อกเวลา 08:20.*ไปไม่ทัน 15 นาที.*ไม่เลื่อนงานที่ล็อก/),
    }));
  });

  it("reports a nonblocking risk for a route leg whose task coordinates are unavailable", () => {
    const plan = buildLocalPlan([
      { id: "first", title: "งานแรก", place: "สยาม", lat: 13.7466, lng: 100.5347, fixedTime: "08:00", durationMin: 30, priority: "normal" },
      { id: "missing", title: "งานไม่มีพิกัด", place: "สถานที่ที่บันทึกชื่ออย่างเดียว", fixedTime: "09:00", durationMin: 30, priority: "normal" },
    ], {
      dayStart: "08:00",
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "available",
        originIncluded: true,
        nodes: [
          { index: 0, kind: "origin", label: "บ้าน" },
          { index: 1, kind: "task", taskId: "first", label: "สยาม" },
        ],
        durationsMin: [[0, 10], [10, 0]],
      },
    });

    expect(plan.plans.A.schedule.find((item) => item.taskId === "first")).toMatchObject({ start: "08:10", end: "08:40" });
    expect(plan.plans.A.schedule.find((item) => item.taskId === "missing")?.travelFromPrevMin).toBe(0);
    expect(plan.plans.A.riskPoints).toContainEqual(expect.objectContaining({
      time: "การเดินทาง",
      reason: expect.stringContaining("ไม่มีพิกัดของ งานไม่มีพิกัด"),
    }));
  });

  it("never consumes durations from an unavailable travel context", () => {
    const plan = buildLocalPlan([
      { id: "one", title: "งาน", place: "สยาม", lat: 13.7466, lng: 100.5347, durationMin: 30, priority: "normal" },
    ], {
      startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
      travelContext: {
        status: "unavailable",
        originIncluded: true,
        nodes: [{ index: 0, kind: "origin", label: "บ้าน" }, { index: 1, kind: "task", taskId: "one", label: "สยาม" }],
        reason: "route_service_unavailable",
      },
    });
    expect(plan.plans.A.schedule[0].travelFromPrevMin).toBe(0);
    expect(plan.tip).toContain("ไม่สามารถคำนวณเวลาเส้นทาง");
  });
});
