import { parseThaiHints } from "@/lib/natural-language";
import { AiModeSchema, IsoDateSchema, PrioritySchema, TimeSchema } from "@/lib/types";
import { z } from "zod";

const RepeatSchema = z.enum(["none", "daily", "weekly", "monthly", "yearly"]);
const OptionalModelTimeSchema = z.union([TimeSchema, z.literal("")]);
const OptionalModelDateSchema = z.union([IsoDateSchema, z.literal("")]);

/** Shape required from the model before blank optional fields are normalized. */
export const ModelParsedTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  place: z.string().max(300),
  durationMin: z.number().int().min(15).max(24 * 60),
  fixedTime: OptionalModelTimeSchema,
  allDay: z.boolean(),
  deadlineDate: OptionalModelDateSchema,
  deadlineTime: OptionalModelTimeSchema,
  priority: PrioritySchema,
  categoryName: z.string().max(80),
  reminderOffsets: z.array(z.number().int().min(0).max(10080)).max(20),
  repeat: RepeatSchema,
  needsReview: z.boolean(),
  note: z.string().max(500),
});

export const ParsedTaskDraftSchema = z.object({
  title: z.string().trim().min(1).max(300),
  place: z.string().max(300).default(""),
  durationMin: z.number().int().min(15).max(24 * 60),
  fixedTime: TimeSchema.optional(),
  allDay: z.boolean().default(false),
  deadlineDate: IsoDateSchema.optional(),
  deadlineTime: TimeSchema.optional(),
  priority: PrioritySchema.default("normal"),
  categoryName: z.string().max(80).optional(),
  reminderOffsets: z.array(z.number().int().min(0).max(10080)).max(20).default([]),
  repeat: RepeatSchema.default("none"),
  needsReview: z.boolean().default(false),
  note: z.string().max(500).default(""),
});

export const ParsedTasksResponseSchema = z.object({
  tasks: z.array(ParsedTaskDraftSchema).max(20),
  mode: AiModeSchema,
});

export type ModelParsedTask = z.infer<typeof ModelParsedTaskSchema>;
export type ParsedTaskDraft = z.infer<typeof ParsedTaskDraftSchema>;
export type ParsedTasksResponse = z.infer<typeof ParsedTasksResponseSchema>;

/** Converts model-required empty strings into omitted optional domain fields. */
export function normalizeParsedTask(task: ModelParsedTask): ParsedTaskDraft {
  return ParsedTaskDraftSchema.parse({
    ...task,
    fixedTime: task.fixedTime || undefined,
    deadlineDate: task.deadlineDate || undefined,
    deadlineTime: task.deadlineTime || undefined,
    categoryName: task.categoryName.trim() || undefined,
    note: task.note.trim(),
  });
}
/** A deterministic fallback built from the existing Thai hint parser. */
export function buildLocalParsedTasks(text: string, selectedDate: string): ParsedTaskDraft[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  return lines.map((line) => {
    const hints = parseThaiHints(line, selectedDate);
    const fixedTime = hints.time && TimeSchema.safeParse(hints.time).success ? hints.time : undefined;
    const deadlineDate = hints.date && IsoDateSchema.safeParse(hints.date).success ? hints.date : undefined;
    const needsReview = !fixedTime && !hints.allDay;

    return ParsedTaskDraftSchema.parse({
      title: line.slice(0, 300),
      place: "",
      durationMin: Math.max(15, Math.min(24 * 60, hints.durationMin ?? 60)),
      fixedTime,
      allDay: hints.allDay,
      deadlineDate,
      priority: hints.priority ?? "normal",
      reminderOffsets: hints.reminderOffsets,
      repeat: hints.repeat ?? "none",
      needsReview,
      note: needsReview ? "โหมด Local ยังไม่พบเวลาเริ่ม กรุณาตรวจสอบก่อนยืนยัน" : "",
    });
  });
}
