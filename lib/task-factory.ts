import { TaskSchema, type LocationSource, type Priority, type Task } from "@/lib/types";

export interface NewTaskInput {
  title: string;
  place?: string;
  lat?: number;
  lng?: number;
  locationSource?: LocationSource;
  locationAccuracy?: number;
  locationCapturedAt?: string;
  fixedTime?: string;
  durationMin?: number;
  allDay?: boolean;
  lockTime?: boolean;
  deadlineDate?: string;
  deadlineTime?: string;
  priority?: Priority;
  categoryId?: string;
  reminderOffsets?: number[];
  note?: string;
}

export function createTask(input: NewTaskInput, order = 0, now = new Date()): Task {
  return TaskSchema.parse({
    id: globalThis.crypto?.randomUUID?.() ?? `task-${now.getTime().toString(36)}`,
    ...input,
    title: input.title.trim(),
    place: input.place ?? "",
    priority: input.priority ?? "normal",
    order,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}
