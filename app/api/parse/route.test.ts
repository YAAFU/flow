import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/parse/route";
import { ParsedTasksResponseSchema } from "@/lib/ai-parse";

afterEach(() => vi.unstubAllEnvs());

describe("parse route local fallback", () => {
  it("parses locally without an API key and returns normalized optional fields", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const request = new NextRequest("http://localhost/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "พรุ่งนี้ประชุม 10 โมง 1 ชั่วโมง",
        nowIso: "2026-07-21T12:00:00.000Z",
        timezone: "Asia/Bangkok",
        selectedDate: "2026-07-21",
      }),
    });
    const response = await POST(request);
    const json = ParsedTasksResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(json.mode).toBe("local");
    expect(json.tasks[0]).toMatchObject({ fixedTime: "10:00", deadlineDate: "2026-07-22" });
    expect(json.tasks[0].deadlineTime).toBeUndefined();
  });

  it("rejects an invalid request rather than creating a draft", async () => {
    const response = await POST(new NextRequest("http://localhost/api/parse", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x" }),
    }));
    expect(response.status).toBe(400);
  });
});
