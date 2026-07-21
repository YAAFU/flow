import { afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { extractJson } from "@/lib/claude";
import { PlanResultSchema } from "@/lib/types";
import { buildLocalPlan } from "@/lib/local-planner";
import { POST } from "@/app/api/plan/route";

afterEach(() => vi.unstubAllEnvs());

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
});
