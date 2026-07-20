import { TaskSchema, type FlowState, type Task } from "@/lib/types";
import { parseDateKey } from "@/lib/time";

function assertDate(date: string): void {
  if (!parseDateKey(date)) throw new Error(`Invalid ISO date: ${date}`);
}

export function addTaskToDate(tasksByDay: FlowState["tasksByDay"], date: string, task: Task): FlowState["tasksByDay"] {
  assertDate(date);
  const normalized = TaskSchema.parse(task);
  const current = tasksByDay[date] ?? [];
  if (current.some((item) => item.id === normalized.id)) return tasksByDay;
  return { ...tasksByDay, [date]: [...current, normalized] };
}

export function updateTaskInDate(tasksByDay: FlowState["tasksByDay"], date: string, task: Task, now = new Date()): FlowState["tasksByDay"] {
  assertDate(date);
  const current = tasksByDay[date] ?? [];
  const existing = current.find((item) => item.id === task.id);
  if (!existing) throw new Error(`Task not found: ${task.id}`);
  const normalized = TaskSchema.parse({
    ...existing,
    ...task,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: now.toISOString(),
  });
  return { ...tasksByDay, [date]: current.map((item) => item.id === normalized.id ? normalized : item) };
}

export function removeTaskFromDate(tasksByDay: FlowState["tasksByDay"], date: string, taskId: string): FlowState["tasksByDay"] {
  assertDate(date);
  return { ...tasksByDay, [date]: (tasksByDay[date] ?? []).filter((item) => item.id !== taskId) };
}
