import { z } from "zod";
import {
  DayEnergySchema,
  IsoDateSchema,
  LocationSourceSchema,
  TaskSchema,
  TimeSchema,
  type Task,
} from "@/lib/types";

export const PlanningStartLocationSchema = z.object({
  name: z.string().trim().max(200).optional(),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  source: LocationSourceSchema,
  capturedAt: z.string().datetime().optional(),
  accuracy: z.number().finite().min(0).max(100_000).optional(),
});

export const PlanningLockedTimeSchema = z.object({
  taskId: z.string().min(1),
  startTime: TimeSchema,
  durationMin: z.number().int().min(1).max(24 * 60).optional(),
});

export const PlanningContextSchema = z.object({
  date: IsoDateSchema,
  timezone: z.string().trim().min(1).max(100).default("Asia/Bangkok"),
  energyLevel: DayEnergySchema.default("medium"),
  startLocation: PlanningStartLocationSchema.optional(),
  tasks: z.array(TaskSchema).min(1).max(200),
  lockedTimes: z.array(PlanningLockedTimeSchema).max(200).default([]),
}).superRefine((context, issueContext) => {
  const taskIds = new Set(context.tasks.map((task) => task.id));
  const lockedIds = new Set<string>();
  for (const locked of context.lockedTimes) {
    if (!taskIds.has(locked.taskId)) {
      issueContext.addIssue({
        code: "custom",
        path: ["lockedTimes"],
        message: `locked task ${locked.taskId} is not present in tasks`,
      });
    }
    if (lockedIds.has(locked.taskId)) {
      issueContext.addIssue({
        code: "custom",
        path: ["lockedTimes"],
        message: `duplicate locked task ${locked.taskId}`,
      });
    }
    lockedIds.add(locked.taskId);
  }
});

export type PlanningStartLocation = z.infer<typeof PlanningStartLocationSchema>;
export type PlanningLockedTime = z.infer<typeof PlanningLockedTimeSchema>;
export type PlanningContext = z.infer<typeof PlanningContextSchema>;

export function lockedTimesFromTasks(tasks: Task[]): PlanningLockedTime[] {
  return tasks.flatMap((task) => task.lockTime && task.fixedTime
    ? [{ taskId: task.id, startTime: task.fixedTime, durationMin: task.durationMin }]
    : []);
}

/**
 * Task fields are the source of truth for locks already stored by Flow. Explicit
 * context locks are still supported for callers that build a planning-only
 * context, but a stored lock always wins for the same task id.
 */
export function normalizePlanningContext(input: unknown): PlanningContext {
  const parsed = PlanningContextSchema.parse(input);
  const declared = new Map(parsed.lockedTimes.map((locked) => [locked.taskId, locked]));
  for (const locked of lockedTimesFromTasks(parsed.tasks)) declared.set(locked.taskId, locked);
  return { ...parsed, lockedTimes: [...declared.values()] };
}

/**
 * Coordinates are useful for route calculation on the server, but the model
 * only needs place labels plus a trusted travel matrix. This projection keeps
 * raw latitude, longitude and location accuracy out of provider payloads.
 */
export function planningContextForModel(context: PlanningContext) {
  return {
    date: context.date,
    timezone: context.timezone,
    energyLevel: context.energyLevel,
    startLocation: context.startLocation
      ? { name: context.startLocation.name?.trim() || "จุดเริ่มต้นที่ผู้ใช้เลือก", source: context.startLocation.source }
      : null,
    tasks: context.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      place: task.place,
      fixedTime: task.fixedTime,
      durationMin: task.durationMin,
      allDay: task.allDay,
      lockTime: task.lockTime,
      deadlineDate: task.deadlineDate,
      deadlineTime: task.deadlineTime,
      priority: task.priority,
      categoryId: task.categoryId,
      note: task.note,
    })),
    lockedTimes: context.lockedTimes,
  };
}
