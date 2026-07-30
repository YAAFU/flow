import type { Task } from "@/lib/types";
import { localDateKey } from "@/lib/time";

export interface FlowStatistics {
  total: number;
  completed: number;
  completionRate: number;
  plannedMinutes: number;
  completedMinutes: number;
  overdue: number;
}

export function calculateStatistics(tasksByDay: Record<string, Task[]>, from: string, to: string, now = new Date()): FlowStatistics {
  const tasks = Object.entries(tasksByDay).filter(([date]) => date >= from && date <= to).flatMap(([, items]) => items);
  const completed = tasks.filter((task) => task.done);
  const nowKey = localDateKey(now);
  return {
    total: tasks.length,
    completed: completed.length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    plannedMinutes: tasks.reduce((sum, task) => sum + (task.durationMin ?? 0), 0),
    completedMinutes: completed.reduce((sum, task) => sum + (task.durationMin ?? 0), 0),
    overdue: Object.entries(tasksByDay).filter(([date]) => date < nowKey && date >= from && date <= to).flatMap(([, items]) => items).filter((task) => !task.done).length,
  };
}
