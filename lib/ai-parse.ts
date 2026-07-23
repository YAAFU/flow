import { z } from "zod";
import { AiModeSchema, IsoDateSchema, LocationSourceSchema, PrioritySchema, TimeSchema } from "@/lib/types";
import { parseLocalSchedule } from "@/lib/schedule-parser/local";
import {
  DurationSourceSchema,
  ParserMetadataSchema,
  ParsedScheduleSchema,
  ParsedTimeWindowSchema,
  type ParsedSchedule,
} from "@/lib/schedule-parser/schema";

const RepeatSchema = z.enum(["none", "daily", "weekly", "monthly", "yearly"]);
const OptionalModelTimeSchema = z.union([TimeSchema, z.literal(""), z.null()]);
const OptionalModelDateSchema = z.union([IsoDateSchema, z.literal(""), z.null()]);

/** Compatibility shape used by old fixtures; all values still pass the shared domain schema. */
export const ModelParsedTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  place: z.string().max(300).default(""),
  durationMin: z.number().int().min(1).max(24 * 60).nullable().optional(),
  fixedTime: OptionalModelTimeSchema.default(""),
  allDay: z.boolean().default(false),
  deadlineDate: OptionalModelDateSchema.default(""),
  deadlineTime: OptionalModelTimeSchema.default(""),
  priority: PrioritySchema.default("normal"),
  categoryName: z.string().max(80).default(""),
  reminderOffsets: z.array(z.number().int().min(0).max(10080)).max(20).default([]),
  repeat: RepeatSchema.default("none"),
  needsReview: z.boolean().default(false),
  note: z.string().max(500).default(""),
});

export const ParsedTaskDraftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  date: IsoDateSchema.optional(),
  place: z.string().max(300).default(""),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
  locationSource: LocationSourceSchema.optional(),
  locationAccuracy: z.number().finite().nonnegative().max(100_000).optional(),
  locationCapturedAt: z.string().datetime().optional(),
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
  durationSource: DurationSourceSchema.optional(),
  fixedTime: TimeSchema.optional(),
  lockTime: z.boolean().optional(),
  timeWindow: ParsedTimeWindowSchema.optional(),
  allDay: z.boolean().default(false),
  deadlineDate: IsoDateSchema.optional(),
  deadlineTime: TimeSchema.optional(),
  priority: PrioritySchema.default("normal"),
  categoryName: z.string().max(80).optional(),
  reminderOffsets: z.array(z.number().int().min(0).max(10080)).max(20).default([]),
  repeat: RepeatSchema.default("none"),
  needsReview: z.boolean().default(false),
  note: z.string().max(500).default(""),
  reviewReason: z.string().max(500).optional(),
  sourceText: z.string().max(1_000).optional(),
  confidence: z.number().finite().min(0).max(1).optional(),
}).superRefine((draft, context) => {
  if ((draft.lat == null) !== (draft.lng == null)) {
    context.addIssue({
      code: "custom",
      path: [draft.lat == null ? "lat" : "lng"],
      message: "lat และ lng ต้องระบุพร้อมกัน",
    });
  }
  if (draft.lockTime && !draft.fixedTime) {
    context.addIssue({ code: "custom", path: ["lockTime"], message: "ล็อกเวลาได้เมื่อมีเวลาเริ่ม" });
  }
});

export const ParsedTasksResponseSchema = z.object({
  tasks: z.array(ParsedTaskDraftSchema).max(20),
  mode: AiModeSchema,
  date: IsoDateSchema.optional(),
  timezone: z.literal("Asia/Bangkok").default("Asia/Bangkok"),
  warnings: z.array(z.string().max(500)).max(20).default([]),
  metadata: ParserMetadataSchema.optional(),
});

export type ModelParsedTask = z.infer<typeof ModelParsedTaskSchema>;
export type ParsedTaskDraft = z.infer<typeof ParsedTaskDraftSchema>;
export type ParsedTasksResponse = z.input<typeof ParsedTasksResponseSchema>;

export function normalizeParsedTask(task: ModelParsedTask): ParsedTaskDraft {
  return ParsedTaskDraftSchema.parse({
    ...task,
    durationMin: task.durationMin ?? undefined,
    durationSource: task.durationMin == null ? "unknown" : "explicit",
    fixedTime: task.fixedTime || undefined,
    deadlineDate: task.deadlineDate || undefined,
    deadlineTime: task.deadlineTime || undefined,
    categoryName: task.categoryName.trim() || undefined,
    note: task.note.trim(),
  });
}

export function scheduleToParsedTasks(schedule: ParsedSchedule): ParsedTasksResponse {
  return ParsedTasksResponseSchema.parse({
    tasks: schedule.items.map((item) => ({
      title: item.title,
      date: item.date,
      place: item.location?.name ?? "",
      locationSource: item.location ? "manual" : undefined,
      durationMin: item.durationMin ?? undefined,
      durationSource: item.durationSource,
      fixedTime: item.startTime ?? undefined,
      lockTime: item.lockTime,
      timeWindow: item.timeWindow,
      allDay: false,
      deadlineDate: item.deadline ? item.date : undefined,
      deadlineTime: item.deadline ?? undefined,
      priority: item.priority,
      reminderOffsets: item.reminderOffsets,
      repeat: item.repeat,
      needsReview: item.needsReview,
      note: item.reviewReason ?? "",
      reviewReason: item.reviewReason,
      sourceText: item.sourceText,
      confidence: item.confidence,
    })),
    mode: schedule.metadata.parserMode,
    date: schedule.date,
    timezone: schedule.timezone,
    warnings: schedule.warnings,
    metadata: schedule.metadata,
  });
}

/** Deterministic fallback that shares the same schema and normalization as AI output. */
export function buildLocalParsedTasks(text: string, selectedDate: string): ParsedTaskDraft[] {
  return scheduleToParsedTasks(parseLocalSchedule({
    text,
    referenceDate: selectedDate,
    timezone: "Asia/Bangkok",
    locale: "th-TH",
  })).tasks.map((task) => ParsedTaskDraftSchema.parse(task));
}

export { ParsedScheduleSchema };
