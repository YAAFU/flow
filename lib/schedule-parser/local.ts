import { addDaysToDateKey, parseDateKey } from "@/lib/time";
import {
  MAX_PARSED_ITEMS,
  ParsedScheduleSchema,
  ScheduleParserRequestSchema,
  SCHEDULE_PARSER_VERSION,
  SCHEDULE_PROMPT_VERSION,
  type ParseScheduleRequest,
  type ParsedSchedule,
  type ParsedScheduleItem,
  type ScheduleParser,
} from "@/lib/schedule-parser/schema";

const ACTIONS = [
  "ตื่นนอน", "ตื่น", "อาบน้ำ", "ดูหนัง", "กลับบ้าน", "ทำรายงาน", "ประชุม", "เข้าเรียน",
  "เรียน", "ซื้อของ", "ออกกำลังกาย", "อ่านหนังสือ", "กินข้าว", "ทานข้าว", "เดินทาง",
  "ส่งงาน", "โทร", "ไป", "ทำงาน", "ซ้อม", "นัด",
] as const;
const ACTION_PATTERN = new RegExp([...ACTIONS].sort((left, right) => right.length - left.length).join("|"), "gu");
const TASK_SIGNAL = new RegExp(ACTIONS.join("|"), "u");

const THAI_DAY_INDEX: Record<string, number> = {
  อาทิตย์: 0, จันทร์: 1, อังคาร: 2, พุธ: 3, พฤหัสบดี: 4, ศุกร์: 5, เสาร์: 6,
};

function weekdayDate(text: string, referenceDate: string): string | null {
  const match = text.match(/วัน(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)/u);
  if (!match) return null;
  const parsed = parseDateKey(referenceDate);
  if (!parsed) return null;
  const current = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  let delta = (THAI_DAY_INDEX[match[1]] - current + 7) % 7;
  if (delta === 0 && /หน้า/u.test(text)) delta = 7;
  return addDaysToDateKey(referenceDate, delta);
}

function resolveDate(text: string, referenceDate: string): string | null {
  if (/มะรืน/u.test(text)) return addDaysToDateKey(referenceDate, 2);
  if (/พรุ่งนี้/u.test(text)) return addDaysToDateKey(referenceDate, 1);
  if (/วันนี้/u.test(text)) return referenceDate;
  return weekdayDate(text, referenceDate);
}

function numberWord(value: string): number | null {
  const words: Record<string, number> = { หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5, หก: 6 };
  if (value in words) return words[value];
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clock(hour: number, minute = 0): string | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function extractTime(text: string): string | null {
  const colon = text.match(/(?:รอบ|เวลา|ตอน)?\s*(\d{1,2}):(\d{2})/u);
  if (colon) return clock(Number(colon[1]), Number(colon[2]));
  if (/บ่ายโมง/u.test(text)) return "13:00";
  const afternoon = text.match(/บ่าย\s*([1-5๑-๕]|\d{1,2})/u);
  if (afternoon) {
    const value = numberWord(afternoon[1]);
    return value == null ? null : clock(12 + value);
  }
  const evening = text.match(/(\d{1,2})\s*โมงเย็น/u);
  if (evening) return clock(Number(evening[1]) <= 11 ? Number(evening[1]) + 12 : Number(evening[1]));
  const morning = text.match(/(\d{1,2})\s*โมงเช้า/u);
  if (morning) return clock(Number(morning[1]));
  const oclock = text.match(/(\d{1,2})\s*โมง(?!เย็น|เช้า)/u);
  if (oclock) return clock(Number(oclock[1]));
  const thum = text.match(/(?:(\d+|หนึ่ง|สอง|สาม|สี่|ห้า)\s*)?ทุ่ม/u);
  if (thum) {
    const value = thum[1] ? numberWord(thum[1]) : 1;
    return value == null ? null : clock(18 + value);
  }
  if (/เที่ยงคืน/u.test(text)) return "00:00";
  if (/(?:ตอน)?เที่ยง/u.test(text)) return "12:00";
  return null;
}

function extractDuration(text: string): number | null {
  const withoutReminder = text.replace(/เตือน(?:ก่อน)?\s*\d+\s*(?:ชั่วโมง|ชม\.?|นาที)/gu, "");
  if (/ครึ่งชั่วโมง/u.test(withoutReminder)) return 30;
  if (/ชั่วโมงครึ่ง/u.test(withoutReminder)) return 90;
  const combined = withoutReminder.match(/(\d+)\s*(?:ชั่วโมง|ชม\.?)\s*(\d+)\s*นาที/u);
  if (combined) return Number(combined[1]) * 60 + Number(combined[2]);
  const hours = withoutReminder.match(/(\d+(?:\.\d+)?)\s*(?:ชั่วโมง|ชม\.?)/u);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const minutes = withoutReminder.match(/(\d+)\s*นาที/u);
  return minutes ? Number(minutes[1]) : null;
}

function reminderOffsets(text: string): number[] {
  const match = text.match(/เตือน(?:ก่อน)?\s*(\d+)\s*(ชั่วโมง|ชม\.?|นาที)/u);
  if (!match) return [];
  return [Number(match[1]) * (/ชั่วโมง|ชม/u.test(match[2]) ? 60 : 1)];
}

function repeat(text: string): ParsedScheduleItem["repeat"] {
  if (/ทุกวัน/u.test(text)) return "daily";
  if (/ทุกสัปดาห์|ทุกอาทิตย์/u.test(text)) return "weekly";
  if (/ทุกเดือน/u.test(text)) return "monthly";
  if (/ทุกปี/u.test(text)) return "yearly";
  return "none";
}

function timeWindow(text: string): ParsedScheduleItem["timeWindow"] {
  if (/ตอนเช้า|ช่วงเช้า|เช้านี้/u.test(text)) return { label: "morning", start: "06:00", end: "12:00" };
  if (/ตอนบ่าย|ช่วงบ่าย/u.test(text)) return { label: "afternoon", start: "12:00", end: "17:00" };
  if (/ตอนเย็น|ช่วงเย็น/u.test(text)) return { label: "evening", start: "17:00", end: "21:00" };
  if (/กลางคืน|ก่อนนอน|คืนนี้/u.test(text)) return { label: "night", start: "21:00", end: "23:59" };
  return null;
}

function extractLocation(text: string): ParsedScheduleItem["location"] {
  const marker = text.lastIndexOf("ที่");
  if (marker < 0) return null;
  const tail = text.slice(marker + "ที่".length).trim()
    .split(/\s+(?=(?:เวลา|ตอน|ช่วง|ก่อน|หลัง|รอบ|\d{1,2}(?::\d{2})?))/u)[0]
    .replace(/[,.!?]+$/u, "")
    .trim();
  if (!tail || tail.length > 300) return null;
  return { name: tail, source: "text" };
}

function cleanTitle(source: string, locationName?: string): string {
  let title = source
    .replace(/(?:วันนี้|พรุ่งนี้|มะรืน|วัน(?:อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)(?:หน้า)?)/gu, " ")
    .replace(/(?:รอบ|เวลา|ตอน)?\s*\d{1,2}:\d{2}/gu, " ")
    .replace(/(?:บ่ายโมง|บ่าย\s*\d{1,2}|\d{1,2}\s*โมง(?:เช้า|เย็น)?|(?:\d+|หนึ่ง|สอง|สาม|สี่|ห้า)?\s*ทุ่ม|เที่ยงคืน|เที่ยง)/gu, " ")
    .replace(/(?:\d+(?:\.\d+)?\s*(?:ชั่วโมง|ชม\.?)\s*(?:\d+\s*นาที)?|\d+\s*นาที|ครึ่งชั่วโมง|ชั่วโมงครึ่ง)/gu, " ")
    .replace(/เตือน(?:ก่อน)?\s*/gu, " ")
    .replace(/ทุก(?:วัน|สัปดาห์|อาทิตย์|เดือน|ปี)/gu, " ")
    .replace(/ด่วนที่สุด|ด่วน|สำคัญมาก|สำคัญ|ยืดหยุ่น|ยืดได้/gu, " ")
    .replace(/(?:ตอน|ช่วง)(?:เช้า|บ่าย|เย็น)|กลางคืน|ก่อนนอน/gu, " ");
  if (locationName) title = title.replace(new RegExp(`ที่\\s*${locationName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "u"), " ");
  return title.replace(/\s+/gu, " ").replace(/^(?:แล้ว|จากนั้น|ต่อด้วย)\s*/u, "").trim();
}

function splitActionClauses(text: string): string[] {
  const initial = text
    .replace(/\r?\n+/gu, " | ")
    .replace(/[;。!?]+/gu, " | ")
    .replace(/\s+(?:แล้ว|จากนั้น|ต่อด้วย|หลังจากนั้น)\s*/gu, " | ");
  const chunks = initial.split("|").map((chunk) => chunk.trim()).filter(Boolean);
  const result: string[] = [];
  for (const chunk of chunks) {
    const matches = [...chunk.matchAll(ACTION_PATTERN)];
    if (matches.length <= 1) {
      result.push(chunk);
      continue;
    }
    for (let index = 0; index < matches.length; index += 1) {
      const start = index === 0 ? 0 : matches[index].index!;
      const end = matches[index + 1]?.index ?? chunk.length;
      const clause = chunk.slice(start, end).trim();
      if (clause) result.push(clause);
    }
  }
  return result.slice(0, MAX_PARSED_ITEMS);
}

function priority(text: string): ParsedScheduleItem["priority"] {
  if (/ด่วนที่สุด|ด่วน/u.test(text)) return "urgent";
  if (/สำคัญมาก|สำคัญ/u.test(text)) return "high";
  if (/ยืดได้|ยืดหยุ่น|เมื่อไหร่ก็ได้/u.test(text)) return "flex";
  return "normal";
}

export function parseLocalSchedule(rawInput: ParseScheduleRequest): ParsedSchedule {
  const input = ScheduleParserRequestSchema.parse(rawInput);
  const globalDate = resolveDate(input.text, input.referenceDate) ?? input.referenceDate;
  const clauses = splitActionClauses(input.text);
  const items = clauses.flatMap((source, index): ParsedScheduleItem[] => {
    const hasSignal = TASK_SIGNAL.test(source) || /\d{1,2}:\d{2}|\d+\s*(?:ชั่วโมง|ชม\.?|นาที)/u.test(source);
    if (!hasSignal) return [];
    const deadlineMatch = source.match(/ก่อน\s*(?:เวลา\s*)?(?:\d{1,2}:\d{2}|\d{1,2}\s*โมงเย็น|\d{1,2}\s*โมงเช้า|\d{1,2}\s*โมง|บ่ายโมง|บ่าย\s*\d{1,2}|(?:\d+|หนึ่ง|สอง|สาม|สี่|ห้า)?\s*ทุ่ม)/u);
    const deadline = deadlineMatch ? extractTime(deadlineMatch[0]) : null;
    const startTime = extractTime(deadlineMatch ? source.replace(deadlineMatch[0], "") : source);
    const durationMin = extractDuration(source);
    const location = extractLocation(source);
    const title = cleanTitle(source, location?.name).replace(/\s*ก่อน\s*$/u, "").trim();
    if (!title || title.length < 2) return [];
    const ambiguousTravel = /กลับบ้าน|เดินทาง/u.test(title) && startTime !== null;
    const missingDuration = durationMin === null;
    const reasons = [
      ambiguousTravel ? `${startTime} อาจหมายถึงเวลาออกเดินทางหรือเวลาถึง กรุณาตรวจสอบ` : "",
      missingDuration ? "ยังไม่ได้ระบุระยะเวลา" : "",
    ].filter(Boolean);
    return [{
      tempId: `local-${index + 1}`,
      title,
      date: resolveDate(source, input.referenceDate) ?? globalDate,
      startTime,
      durationMin,
      timeWindow: timeWindow(source),
      deadline,
      reminderOffsets: reminderOffsets(source),
      repeat: repeat(source),
      location,
      fixedTime: startTime !== null,
      lockTime: startTime !== null && !ambiguousTravel,
      priority: priority(source),
      durationSource: durationMin === null ? "unknown" : "explicit",
      confidence: ambiguousTravel ? 0.62 : startTime || durationMin ? 0.9 : 0.7,
      needsReview: reasons.length > 0,
      reviewReason: reasons.join(" · ") || undefined,
      sourceText: source,
    }];
  });
  return ParsedScheduleSchema.parse({
    date: items[0]?.date ?? globalDate,
    timezone: "Asia/Bangkok",
    items,
    warnings: items.length ? [] : ["ยังแยกงานจากข้อความนี้ไม่ได้ ลองระบุสิ่งที่ต้องทำและเวลาให้ชัดขึ้น"],
    metadata: {
      parserMode: "local",
      parserVersion: SCHEDULE_PARSER_VERSION,
      promptVersion: SCHEDULE_PROMPT_VERSION,
    },
  });
}

export class LocalScheduleParser implements ScheduleParser {
  async parse(input: ParseScheduleRequest): Promise<ParsedSchedule> {
    return parseLocalSchedule(input);
  }
}
