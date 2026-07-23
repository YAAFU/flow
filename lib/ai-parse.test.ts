import { describe, expect, it } from "vitest";
import { buildLocalParsedTasks, normalizeParsedTask } from "@/lib/ai-parse";

describe("AI parse normalization and local fallback", () => {
  it("omits blank optional date/time fields instead of leaking empty strings", () => {
    const task = normalizeParsedTask({
      title: "อ่านหนังสือ",
      place: "",
      durationMin: 60,
      fixedTime: "",
      allDay: false,
      deadlineDate: "",
      deadlineTime: "",
      priority: "normal",
      categoryName: "",
      reminderOffsets: [],
      repeat: "none",
      needsReview: true,
      note: "",
    });
    expect(task.fixedTime).toBeUndefined();
    expect(task.deadlineDate).toBeUndefined();
    expect(task.deadlineTime).toBeUndefined();
    expect(task.categoryName).toBeUndefined();
  });

  it("builds deterministic drafts without confusing the task date with a deadline", () => {
    const first = buildLocalParsedTasks("พรุ่งนี้ประชุม 10 โมง 1 ชั่วโมง เตือนก่อน 10 นาที", "2026-07-21");
    const second = buildLocalParsedTasks("พรุ่งนี้ประชุม 10 โมง 1 ชั่วโมง เตือนก่อน 10 นาที", "2026-07-21");
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      fixedTime: "10:00",
      durationMin: 60,
      date: "2026-07-22",
    });
    expect(first[0].deadlineDate).toBeUndefined();
  });

  it("marks an invalid or missing time for review", () => {
    expect(buildLocalParsedTasks("ประชุม 25 โมง", "2026-07-21")[0]).toMatchObject({
      fixedTime: undefined,
      needsReview: true,
    });
  });

  it("does not invent a one-hour duration when none was provided", () => {
    expect(buildLocalParsedTasks("พรุ่งนี้ดูหนังรอบ 12:30 ที่สยาม", "2026-07-21")[0]).toMatchObject({
      date: "2026-07-22",
      fixedTime: "12:30",
      place: "สยาม",
      durationMin: undefined,
      durationSource: "unknown",
      needsReview: true,
    });
  });
});
