import { afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { extractJson } from "@/lib/claude";
import { PlanResultSchema } from "@/lib/types";
import { buildLocalPlan } from "@/lib/local-planner";
import { POST } from "@/app/api/plan/route";

const createMessageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/claude", async () => {
  const actual = await vi.importActual<typeof import("@/lib/claude")>("@/lib/claude");
  return {
    ...actual,
    client: () => ({ messages: { create: createMessageMock } }),
  };
});

afterEach(() => {
  createMessageMock.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("plan contract", () => {
  it("extractJson pulls JSON from chatter", () => {
    const out = extractJson('นี่คือแผน: {"controlScore":78} ครับ');
    expect((out as { controlScore: number }).controlScore).toBe(78);
  });
  it("local fallback matches schema and preserves the request task", () => {
    const plan = buildLocalPlan([{ id: "request-task", title: "งานจริง", place: "", priority: "normal" }]);
    expect(() => PlanResultSchema.parse(plan)).not.toThrow();
    expect(plan.mode).toBe("local");
    expect(plan.plans.B.schedule.map((item) => item.taskId)).toEqual(["request-task"]);
  });

  it("returns a transparent local response when the API key is absent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const request = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tasks: [{ id: "only-real-task", title: "งานจากผู้ใช้", place: "", priority: "normal" }],
        selectedDate: "2026-07-21",
        timezone: "Asia/Bangkok",
      }),
    });
    const response = await POST(request);
    const json = PlanResultSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(json.mode).toBe("local");
    expect(json.plans.B.schedule.map((entry) => entry.taskId)).toEqual(["only-real-task"]);
  });

  it("accepts the structured planning context and uses its energy and origin in local fallback", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        durations: [
          [0, 3_600, 200],
          [3_600, 0, 3_400],
          [200, 3_400, 0],
        ],
      }),
    })));
    const request = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planningContext: {
          date: "2026-07-21",
          timezone: "Asia/Bangkok",
          energyLevel: "low",
          startLocation: { name: "จุดเริ่ม", latitude: 13.746, longitude: 100.535, source: "live" },
          tasks: [
            { id: "far", title: "ไกล", place: "เชียงใหม่", lat: 18.7883, lng: 98.9853, durationMin: 30, priority: "normal", order: 0 },
            { id: "near", title: "ใกล้", place: "สยาม", lat: 13.7466, lng: 100.5347, durationMin: 30, priority: "normal", order: 1 },
          ],
          lockedTimes: [],
        },
        energy: "high",
        dayStart: "09:00",
        breakMin: 30,
      }),
    });
    const response = await POST(request);
    const json = PlanResultSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(json.mode).toBe("local");
    expect(json.summary).toContain("พลังงานน้อย");
    expect(json.plans.A.schedule.map((entry) => entry.taskId)).toEqual(["near", "far"]);
    expect(json.plans.A.schedule[1].start).toBe("10:30");
    expect(json.plans.A.schedule.map((entry) => entry.travelFromPrevMin)).toEqual([3, 57]);
    expect(json.plans.A.riskPoints.some((risk) => risk.reason.includes("เวลาเดินทางตามเส้นทางต้องใช้ 57 นาที"))).toBe(false);
  });

  it("uses an OSRM matrix in no-key local mode without making a real network request", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ durations: [[0, 600], [600, 0]] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const request = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planningContext: {
          date: "2026-07-21",
          timezone: "Asia/Bangkok",
          energyLevel: "medium",
          startLocation: { name: "บ้าน", latitude: 13.74, longitude: 100.52, source: "manual" },
          tasks: [{ id: "destination", title: "ไปสยาม", place: "สยาม", lat: 13.7466, lng: 100.5347, fixedTime: "09:00", durationMin: 30, priority: "normal" }],
          lockedTimes: [],
        },
        dayStart: "08:00",
      }),
    });

    const response = await POST(request);
    const json = PlanResultSchema.parse(await response.json());
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(json.mode).toBe("local");
    expect(json.plans.A.schedule[0].travelFromPrevMin).toBe(10);
    expect(json.summary).toContain("ใช้เวลาประมาณจากบริการ routing");
  });

  it("never trusts travel minutes invented by the AI provider", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        durations: [
          [0, 600, 1_200],
          [600, 0, 300],
          [1_200, 300, 0],
        ],
      }),
    })));
    const plan = {
      plans: {
        A: {
          schedule: [
            { taskId: "one", title: "งานหนึ่ง", placeLabel: "หนึ่ง", start: "09:00", end: "09:30", travelFromPrevMin: 999, aiAdded: false },
            { taskId: "two", title: "งานสอง", placeLabel: "สอง", start: "10:00", end: "10:30", travelFromPrevMin: 888, aiAdded: false },
          ],
          controlScore: 80,
          freeTimeMin: 60,
          riskScore: 0,
          riskPoints: [],
        },
        B: {
          schedule: [
            { taskId: "two", title: "งานสอง", placeLabel: "สอง", start: "09:00", end: "09:30", travelFromPrevMin: 777, aiAdded: false },
            { taskId: "one", title: "งานหนึ่ง", placeLabel: "หนึ่ง", start: "10:00", end: "10:30", travelFromPrevMin: 666, aiAdded: false },
          ],
          controlScore: 85,
          freeTimeMin: 60,
          riskScore: 0,
          riskPoints: [],
        },
      },
      summary: "แผนทดสอบ",
      tip: "ตรวจเส้นทาง",
    };
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(plan) }],
      stop_reason: "end_turn",
    });
    const request = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planningContext: {
          date: "2026-07-21",
          timezone: "Asia/Bangkok",
          energyLevel: "medium",
          startLocation: { name: "บ้าน", latitude: 13.7, longitude: 100.5, source: "manual" },
          tasks: [
            { id: "one", title: "งานหนึ่ง", place: "หนึ่ง", lat: 13.71, lng: 100.51, priority: "normal" },
            { id: "two", title: "งานสอง", place: "สอง", lat: 13.72, lng: 100.52, priority: "normal" },
          ],
          lockedTimes: [],
        },
        dayStart: "08:00",
      }),
    });

    const response = await POST(request);
    const json = PlanResultSchema.parse(await response.json());
    expect(json.mode).toBe("ai");
    expect(json.plans.A.schedule.map((item) => item.travelFromPrevMin)).toEqual([10, 5]);
    expect(json.plans.B.schedule.map((item) => item.travelFromPrevMin)).toEqual([20, 5]);
    const providerPayload = JSON.stringify(createMessageMock.mock.calls[0]?.[0]);
    expect(providerPayload).not.toContain("13.71");
    expect(providerPayload).not.toContain("100.51");
  });

  it("zeros an AI travel estimate when a scheduled leg has no coordinate node", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ durations: [[0, 600], [600, 0]] }),
    })));
    const variant = {
      schedule: [
        { taskId: "located", title: "งานนอกบ้าน", placeLabel: "ออฟฟิศ", start: "09:00", end: "09:30", travelFromPrevMin: 999, aiAdded: false },
        { taskId: "missing", title: "โทรหาแม่", placeLabel: "", start: "10:00", end: "10:15", travelFromPrevMin: 45, aiAdded: false },
      ],
      controlScore: 80,
      freeTimeMin: 60,
      riskScore: 0,
      riskPoints: [],
    };
    createMessageMock.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ plans: { A: variant, B: variant }, summary: "แผนทดสอบ", tip: "ตรวจเส้นทาง" }) }],
      stop_reason: "end_turn",
    });
    const request = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planningContext: {
          date: "2026-07-21",
          timezone: "Asia/Bangkok",
          energyLevel: "medium",
          startLocation: { name: "บ้าน", latitude: 13.7, longitude: 100.5, source: "manual" },
          tasks: [
            { id: "located", title: "งานนอกบ้าน", place: "ออฟฟิศ", lat: 13.71, lng: 100.51, priority: "normal" },
            { id: "missing", title: "โทรหาแม่", place: "", priority: "normal" },
          ],
          lockedTimes: [],
        },
      }),
    });

    const response = await POST(request);
    const json = PlanResultSchema.parse(await response.json());
    for (const name of ["A", "B"] as const) {
      expect(json.plans[name].schedule.map((item) => item.travelFromPrevMin)).toEqual([10, 0]);
      expect(json.plans[name].riskPoints).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason: expect.stringContaining("ไม่มีพิกัดหรือข้อมูลเส้นทาง") }),
      ]));
    }
  });

  it("keeps planning available without location and rejects an empty request", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const withoutLocation = new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        planningContext: {
          date: "2026-07-21",
          timezone: "Asia/Bangkok",
          energyLevel: "medium",
          tasks: [{ id: "task", title: "งาน", place: "", priority: "normal" }],
          lockedTimes: [],
        },
      }),
    });
    const response = await POST(withoutLocation);
    const json = PlanResultSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(json.tip).toContain("ไม่ได้ระบุจุดเริ่มต้น");

    const invalid = await POST(new NextRequest("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));
    expect(invalid.status).toBe(400);
  });
});
