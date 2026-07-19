import type { Task } from "@/lib/types";
import { combineLocalDateTime } from "@/lib/time";

export interface DueReminder {
  id: string;
  task: Task;
  date: string;
  offsetMin: number;
  dueAt: Date;
}

export function reminderId(taskId: string, date: string, offsetMin: number): string {
  return `${taskId}:${date}:${offsetMin}`;
}

export function getDueReminders(tasksByDay: Record<string, Task[]>, now: Date, notifiedIds: ReadonlySet<string>): DueReminder[] {
  const due: DueReminder[] = [];
  for (const [date, tasks] of Object.entries(tasksByDay)) {
    for (const task of tasks) {
      if (task.done || task.allDay || !task.fixedTime) continue;
      const start = combineLocalDateTime(date, task.fixedTime).getTime();
      for (const offsetMin of task.reminderOffsets ?? []) {
        const id = reminderId(task.id, date, offsetMin);
        const dueAt = new Date(start - offsetMin * 60_000);
        const age = now.getTime() - dueAt.getTime();
        if (!notifiedIds.has(id) && age >= 0 && age <= 60_000) due.push({ id, task, date, offsetMin, dueAt });
      }
    }
  }
  return due;
}

export function reminderStatus(task: Task, date: string, now: Date): "upcoming" | "near" | "overdue" | "done" {
  if (task.done) return "done";
  if (!task.fixedTime || task.allDay) return "upcoming";
  const delta = combineLocalDateTime(date, task.fixedTime).getTime() - now.getTime();
  if (delta < 0) return "overdue";
  if (delta <= 30 * 60_000) return "near";
  return "upcoming";
}
