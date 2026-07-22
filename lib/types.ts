import { z } from "zod";

export const PrioritySchema = z.enum(["urgent", "high", "normal", "flex"]);
export const AiModeSchema = z.enum(["ai", "local"]);

export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const LocationSourceSchema = z.enum(["search", "quick", "map", "live", "manual"]);

export const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  place: z.string().default(""),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  locationSource: LocationSourceSchema.optional(),
  locationAccuracy: z.number().nonnegative().max(100_000).optional(),
  locationCapturedAt: z.string().datetime().optional(),
  fixedTime: TimeSchema.optional(),
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
  allDay: z.boolean().default(false),
  lockTime: z.boolean().default(false),
  deadlineDate: IsoDateSchema.optional(),
  deadlineTime: TimeSchema.optional(),
  // Kept for lossless migration from flow_tasks_v1.
  deadline: TimeSchema.optional(),
  priority: PrioritySchema.default("normal"),
  categoryId: z.string().optional(),
  reminderOffsets: z.array(z.number().int().min(0).max(10080)).default([]),
  order: z.number().int().default(0),
  done: z.boolean().default(false),
  completedAt: z.string().datetime().optional(),
  aiAdded: z.boolean().default(false),
  needsReview: z.boolean().default(false),
  note: z.string().default(""),
  seriesId: z.string().optional(),
  occurrenceDate: IsoDateSchema.optional(),
  movedCount: z.number().int().min(0).default(0),
  originalDate: IsoDateSchema.optional(),
  createdAt: z.string().datetime().default(() => new Date().toISOString()),
  updatedAt: z.string().datetime().default(() => new Date().toISOString()),
}).catchall(z.any());

export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(40),
  createdAt: z.string().datetime(),
});

export const RecurrenceFrequencySchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export const RecurrenceRuleSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365).default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).default([]),
  monthDay: z.number().int().min(1).max(31).optional(),
  startDate: IsoDateSchema,
  endDate: IsoDateSchema.optional(),
  count: z.number().int().min(1).optional(),
  excludedDates: z.array(IsoDateSchema).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const DayEnergySchema = z.enum(["low", "medium", "high"]);
export const DayMetaSchema = z.object({
  date: IsoDateSchema,
  energy: DayEnergySchema.default("medium"),
  note: z.string().default(""),
});

export const FocusModeSchema = z.enum(["free", "pomodoro", "custom"]);
export const FocusSessionSchema = z.object({
  id: z.string().min(1),
  taskId: z.string().optional(),
  mode: FocusModeSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  plannedMin: z.number().int().min(1),
  actualMin: z.number().int().min(0).optional(),
  completed: z.boolean().default(false),
});
export const ActiveFocusSessionSchema = FocusSessionSchema.pick({ id:true, taskId:true, mode:true, startedAt:true, plannedMin:true }).extend({ pausedAt:z.string().datetime().optional(), pausedMs:z.number().int().min(0).default(0) });

export const ThemeSchema = z.enum(["system", "light", "dark"]);
export const AppSettingsSchema = z.object({
  theme: ThemeSchema.default("system"),
  timelineStartHour: z.number().int().min(0).max(23).default(8),
  timelineEndHour: z.number().int().min(1).max(24).default(22),
  defaultDurationMin: z.number().int().min(15).max(480).default(60),
  notificationsEnabled: z.boolean().default(false),
  autoMode: z.enum(["manual", "time", "location", "both"]).default("manual"),
  timezone: z.string().default("Asia/Bangkok"),
  calendarProvider: z.enum(["none", "google"]).default("none"),
});

export const ScheduleItemSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1),
  placeLabel: z.string(),
  start: TimeSchema,
  end: TimeSchema,
  travelFromPrevMin: z.number().int().min(0),
  aiAdded: z.boolean().optional(),
});

export const RiskPointSchema = z.object({ time: z.string(), reason: z.string() });
export const PlanVariantSchema = z.object({
  schedule: z.array(ScheduleItemSchema),
  controlScore: z.number().min(0).max(100),
  freeTimeMin: z.number().min(0),
  riskScore: z.number().min(0).max(100),
  riskPoints: z.array(RiskPointSchema),
});
export const PlanResultSchema = z.object({
  plans: z.object({ A: PlanVariantSchema, B: PlanVariantSchema }),
  summary: z.string(),
  tip: z.string(),
  mode: AiModeSchema.optional(),
});

export const SlotSuggestionSchema = z.object({
  date: IsoDateSchema,
  start: TimeSchema,
  end: TimeSchema,
  reason: z.string(),
  resultingControlScore: z.number(),
});

export const ReminderLogSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  occurrenceDate: IsoDateSchema,
  offsetMin: z.number().int(),
  notifiedAt: z.string().datetime(),
});

export const FlowStateSchema = z.object({
  schemaVersion: z.literal(2),
  tasksByDay: z.record(z.string(), z.array(TaskSchema)),
  categories: z.array(CategorySchema),
  recurrenceRules: z.array(RecurrenceRuleSchema),
  dayMetaByDay: z.record(z.string(), DayMetaSchema),
  focusSessions: z.array(FocusSessionSchema),
  activeFocusSession: ActiveFocusSessionSchema.optional(),
  settings: AppSettingsSchema,
  reminderLog: z.array(ReminderLogSchema),
  selectedDate: IsoDateSchema,
  updatedAt: z.string().datetime(),
});

export type Priority = z.infer<typeof PrioritySchema>;
export type AiMode = z.infer<typeof AiModeSchema>;
export type LocationSource = z.infer<typeof LocationSourceSchema>;
// Existing fixtures predate timestamps/defaulted fields. Keep their construction
// source-compatible while parsing/storage always produces the normalized output.
type TaskInput = z.input<typeof TaskSchema>;
export type Task = Omit<TaskInput, "place" | "priority" | "createdAt" | "updatedAt"> & {
  place: string;
  priority: Priority;
  createdAt?: string;
  updatedAt?: string;
};
export type StoredTask = z.output<typeof TaskSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;
export type DayEnergy = z.infer<typeof DayEnergySchema>;
export type FocusMode = z.infer<typeof FocusModeSchema>;
export type DayMeta = z.infer<typeof DayMetaSchema>;
export type FocusSession = z.infer<typeof FocusSessionSchema>;
export type ActiveFocusSession = z.infer<typeof ActiveFocusSessionSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type FlowState = z.infer<typeof FlowStateSchema>;
export type AutoMode = AppSettings["autoMode"];
export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;
export type PlanVariant = z.infer<typeof PlanVariantSchema>;
export type PlanResult = z.infer<typeof PlanResultSchema>;
export type SlotSuggestion = z.infer<typeof SlotSuggestionSchema>;
