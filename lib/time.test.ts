import { describe, expect, it } from "vitest";
import { endTime, minutesToTime, snapMinutes, timeToMinutes } from "@/lib/time";

describe("time utilities", () => {
  it("converts and snaps time", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
    expect(snapMinutes(518)).toBe(525);
    expect(endTime("08:30", 45)).toBe("09:15");
  });
});
