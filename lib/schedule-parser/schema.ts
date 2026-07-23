import { z } from "zod";
import { IsoDateSchema, PrioritySchema, TimeSchema } from "@/lib/types";

export const SCHEDULE_PARSER_VERSION = "1.0.0";
export const SCHEDULE_PROMPT_VERSION = "schedule-th-v1";
export const MAX_SCHEDULE_TEXT_LENGTH = 4_000;
export const MAX_PARSED_ITEMS = 20;

export const ScheduleParserRequestSchema = z.object({
  text: z.string().trim().min(3).max(MAX_SCHEDULE_TEXT_LENGTH),
  referenceDate: IsoDateSchema,
  timezone: z.literal("Asia/Bangkok"),
  locale: z.literal("th-TH"),
});

export const DurationSourceSchema = z.enum(["explicit", "inferred", "ai_suggested", "unknown"]);
export const ParsedRepeatSchema = z.enum(["none", "daily", "weekly", "monthly", "yearly"]);
export const TimeWindowLabelSchema = z.enum(["morning", "afternoon", "evening", "night"]);
export const ParsedTimeWindowSchema = z.object({
  start: TimeSchema.optional(),
  end: TimeSchema.optional(),
  label: TimeWindowLabelSchema.optional(),
}).nullable();
export const ParsedTextLocationSchema = z.object({
  name: z.string().trim().min(1).max(300),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  source: z.enum(["text", "search", "manual"]),
}).superRefine((location, context) => {
  if ((location.latitude == null) !== (location.longitude == null)) {
    context.addIssue({ code: "custom", message: "latitude และ longitude ต้องระบุพร้อมกัน" });
  }
}).nullable();

export const ParsedScheduleItemSchema = z.object({
  tempId: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  date: IsoDateSchema,
  startTime: TimeSchema.nullable(),
  durationMin: z.number().int().min(1).max(24 * 60).nullable(),
  timeWindow: ParsedTimeWindowSchema.optional().default(null),
  deadline: TimeSchema.nullable().optional().default(null),
  reminderOffsets: z.array(z.number().int().min(0).max(10_080)).max(20).default([]),
  repeat: ParsedRepeatSchema.default("none"),
  location: ParsedTextLocationSchema.optional().default(null),
  fixedTime: z.boolean(),
  lockTime: z.boolean(),
  priority: PrioritySchema,
  durationSource: DurationSourceSchema,
  confidence: z.number().finite().min(0).max(1),
  needsReview: z.boolean(),
  reviewReason: z.string().trim().max(500).optional(),
  sourceText: z.string().trim().min(1).max(1_000),
}).superRefine((item, context) => {
  if (item.fixedTime && !item.startTime) {
    context.addIssue({ code: "custom", path: ["startTime"], message: "fixedTime ต้องมี startTime" });
  }
  if (item.lockTime && !item.startTime) {
    context.addIssue({ code: "custom", path: ["lockTime"], message: "lockTime ต้องมี startTime" });
  }
  if (item.durationSource === "explicit" && item.durationMin == null) {
    context.addIssue({ code: "custom", path: ["durationMin"], message: "durationSource explicit ต้องมี durationMin" });
  }
});

export const ParserMetadataSchema = z.object({
  parserMode: z.enum(["ai", "local"]),
  parserVersion: z.string().min(1).max(50),
  promptVersion: z.string().min(1).max(80),
  modelVersion: z.string().min(1).max(100).optional(),
});

export const ParsedScheduleSchema = z.object({
  date: IsoDateSchema,
  timezone: z.literal("Asia/Bangkok"),
  items: z.array(ParsedScheduleItemSchema).max(MAX_PARSED_ITEMS),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20),
  metadata: ParserMetadataSchema,
});

export type ParseScheduleRequest = z.infer<typeof ScheduleParserRequestSchema>;
export type ParsedSchedule = z.infer<typeof ParsedScheduleSchema>;
export type ParsedScheduleItem = z.infer<typeof ParsedScheduleItemSchema>;

export interface ScheduleParser {
  parse(input: ParseScheduleRequest): Promise<ParsedSchedule>;
}
