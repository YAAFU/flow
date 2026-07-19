import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/claude";
import { PlanResultSchema } from "@/lib/types";
import { FALLBACK_PLAN } from "@/lib/fixtures";

describe("plan contract", () => {
  it("extractJson pulls JSON from chatter", () => {
    const out = extractJson('นี่คือแผน: {"controlScore":78} ครับ');
    expect((out as { controlScore: number }).controlScore).toBe(78);
  });
  it("fallback plan matches schema", () => {
    expect(() => PlanResultSchema.parse(FALLBACK_PLAN)).not.toThrow();
  });
});
