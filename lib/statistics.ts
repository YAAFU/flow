import type { FocusSession, Task } from "@/lib/types";
import { localDateKey } from "@/lib/time";

export interface FlowStatistics {
  total: number;
  completed: number;
  completionRate: number;
  plannedMinutes: number;
  completedMinutes: number;
  focusMinutes: number;
  overdue: number;
}

export function calculateStatistics(tasksByDay: Record<string, Task[]>, focusSessions: FocusSession[], from: string, to: string, now = new Date()): FlowStatistics {
  const tasks = Object.entries(tasksByDay).filter(([date]) => date >= from && date <= to).flatMap(([, items]) => items);
  const completed = tasks.filter((task) => task.done);
  const focusMinutes = focusSessions.filter((session) => {
    const date = localDateKey(new Date(session.startedAt));
    return date >= from && date <= to;
  }).reduce((sum, session) => sum + (session.actualMin ?? 0), 0);
  const nowKey = localDateKey(now);
  return {
    total: tasks.length,
    completed: completed.length,
    completionRate: tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    plannedMinutes: tasks.reduce((sum, task) => sum + (task.durationMin ?? 0), 0),
    completedMinutes: completed.reduce((sum, task) => sum + (task.durationMin ?? 0), 0),
    focusMinutes,
    overdue: Object.entries(tasksByDay).filter(([date]) => date < nowKey && date >= from && date <= to).flatMap(([, items]) => items).filter((task) => !task.done).length,
  };
}
