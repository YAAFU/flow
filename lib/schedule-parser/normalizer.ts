import { ParsedScheduleSchema, SCHEDULE_PARSER_VERSION, SCHEDULE_PROMPT_VERSION, type ParsedSchedule } from "@/lib/schedule-parser/schema";
import { parseDateKey } from "@/lib/time";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeClock(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const normalized = `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  return TIME.test(normalized) ? normalized : null;
}

export function normalizeParsedSchedule(
  value: Omit<ParsedSchedule, "metadata" | "timezone"> & {
    metadata?: Partial<ParsedSchedule["metadata"]>;
    timezone?: string;
  },
  mode: "ai" | "local",
  modelVersion?: string,
): ParsedSchedule {
  const fallbackDate = parseDateKey(value.date) ? value.date : value.items[0]?.date;
  return ParsedScheduleSchema.parse({
    ...value,
    date: fallbackDate,
    timezone: "Asia/Bangkok",
    items: value.items.map((item, index) => ({
      ...item,
      tempId: item.tempId || `${mode}-${index + 1}`,
      startTime: normalizeClock(item.startTime),
      deadline: normalizeClock(item.deadline),
      confidence: Math.max(0, Math.min(1, item.confidence)),
      location: item.location
        ? { name: item.location.name.trim(), source: item.location.source }
        : null,
    })),
    metadata: {
      parserMode: mode,
      parserVersion: SCHEDULE_PARSER_VERSION,
      promptVersion: SCHEDULE_PROMPT_VERSION,
      modelVersion,
    },
  });
}
