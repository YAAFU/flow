import type { Task } from "@/lib/types";
import { localDateKey, localTimeKey } from "@/lib/time";

export function carryTask(task: Task, fromDate: string, toDate: string, mode: "move" | "duplicate", now = new Date()): Task {
  const id = mode === "duplicate" ? `${task.id}-copy-${now.getTime().toString(36)}` : task.id;
  const timeIsPast = toDate === localDateKey(now) && task.fixedTime && task.fixedTime < localTimeKey(now);
  return {
    ...task,
    id,
    fixedTime: timeIsPast ? undefined : task.fixedTime,
    originalDate: task.originalDate ?? fromDate,
    occurrenceDate: task.seriesId ? toDate : task.occurrenceDate,
    movedCount: (task.movedCount ?? 0) + 1,
    done: false,
    completedAt: undefined,
    createdAt: mode === "duplicate" ? now.toISOString() : task.createdAt,
    updatedAt: now.toISOString(),
  };
}
