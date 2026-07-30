import { describe, expect, it } from "vitest";
import { addDaysToDateKey, combineLocalDateTime, endTime, formatThaiMonthYear, formatThaiTaskDate, localDateKey, minutesToTime, parseDateKey, snapMinutes, timeToMinutes } from "@/lib/time";

describe("time utilities", () => {
  it("converts and snaps time", () => {
    expect(timeToMinutes("08:30")).toBe(510);
    expect(minutesToTime(510)).toBe("08:30");
    expect(snapMinutes(518)).toBe(525);
    expect(endTime("08:30", 45)).toBe("09:15");
  });

  it("uses the Bangkok calendar date around UTC midnight boundaries", () => {
    expect(localDateKey(new Date("2026-07-20T16:59:59.000Z"))).toBe("2026-07-20");
    expect(localDateKey(new Date("2026-07-20T17:00:00.000Z"))).toBe("2026-07-21");
    expect(combineLocalDateTime("2026-07-21", "00:30").toISOString()).toBe("2026-07-20T17:30:00.000Z");
  });

  it("adds ISO calendar days without converting through the device timezone", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2028-02-28", 1)).toBe("2028-02-29");
    expect(parseDateKey("2026-02-30")).toBeNull();
  });

  it("formats Thai labels with a Buddhist year", () => {
    expect(formatThaiTaskDate("2026-07-21")).toBe("อ 21 ก.ค.");
    expect(formatThaiMonthYear(2026, 6)).toBe("กรกฎาคม 2569");
  });
});
