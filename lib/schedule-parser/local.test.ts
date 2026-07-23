import { describe, expect, it } from "vitest";
import { parseLocalSchedule } from "@/lib/schedule-parser/local";
import { ParsedScheduleSchema } from "@/lib/schedule-parser/schema";

const request = (text: string) => ({
  text,
  referenceDate: "2026-07-21",
  timezone: "Asia/Bangkok" as const,
  locale: "th-TH" as const,
});

describe("Thai local schedule parser", () => {
  it("splits the full example into editable structured items", () => {
    const parsed = parseLocalSchedule(request("พรุ่งนี้ตื่น 9 โมง อาบน้ำครึ่งชั่วโมง ดูหนังรอบ 12:30 ที่สยาม กลับบ้าน 16:00 แล้วทำรายงาน 2 ชั่วโมงตอนเย็น"));
    expect(() => ParsedScheduleSchema.parse(parsed)).not.toThrow();
    expect(parsed.items).toHaveLength(5);
    expect(parsed.items[0]).toMatchObject({ title: "ตื่น", date: "2026-07-22", startTime: "09:00", lockTime: true });
    expect(parsed.items[1]).toMatchObject({ title: "อาบน้ำ", durationMin: 30, durationSource: "explicit" });
    expect(parsed.items[2]).toMatchObject({
      title: "ดูหนัง",
      startTime: "12:30",
      durationMin: null,
      location: { name: "สยาม", source: "text" },
      needsReview: true,
    });
    expect(parsed.items[3]).toMatchObject({ title: "กลับบ้าน", startTime: "16:00", needsReview: true });
    expect(parsed.items[3].reviewReason).toContain("เวลาออกเดินทางหรือเวลาถึง");
    expect(parsed.items[4]).toMatchObject({
      title: "ทำรายงาน",
      startTime: null,
      durationMin: 120,
      timeWindow: { label: "evening" },
      fixedTime: false,
    });
  });

  it("understands common spoken Thai time forms", () => {
    expect(parseLocalSchedule(request("บ่าย 2 ประชุมทีม")).items[0].startTime).toBe("14:00");
    expect(parseLocalSchedule(request("4 โมงเย็นกลับบ้าน")).items[0].startTime).toBe("16:00");
    expect(parseLocalSchedule(request("ทุ่มหนึ่งอ่านหนังสือ 30 นาที")).items[0].startTime).toBe("19:00");
  });

  it("keeps deadline, reminder, and recurrence separate from start time and duration", () => {
    const parsed = parseLocalSchedule(request("พรุ่งนี้ส่งรายงานก่อน 6 โมงเย็น เตือนก่อน 30 นาที ทุกสัปดาห์"));
    expect(parsed.items[0]).toMatchObject({
      title: "ส่งรายงาน",
      startTime: null,
      deadline: "18:00",
      durationMin: null,
      reminderOffsets: [30],
      repeat: "weekly",
    });
  });

  it("returns no fake task for text that is not an action", () => {
    const parsed = parseLocalSchedule(request("วันนี้อากาศดีมาก"));
    expect(parsed.items).toEqual([]);
    expect(parsed.warnings[0]).toContain("ยังแยกงาน");
  });

  it("rejects malformed structured data before it can reach the task store", () => {
    expect(() => ParsedScheduleSchema.parse({
      date: "2026-07-22",
      timezone: "Asia/Bangkok",
      items: [{
        tempId: "bad",
        title: "งาน",
        date: "2026-07-22",
        startTime: "25:90",
        durationMin: -1,
        timeWindow: null,
        deadline: null,
        location: null,
        fixedTime: true,
        lockTime: true,
        priority: "normal",
        durationSource: "explicit",
        confidence: 2,
        needsReview: false,
        sourceText: "งาน",
      }],
      warnings: [],
      metadata: { parserMode: "ai", parserVersion: "1.0.0", promptVersion: "schedule-th-v1" },
    })).toThrow();
  });
});
