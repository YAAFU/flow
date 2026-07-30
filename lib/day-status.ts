
export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

export type DayStatus = "empty" | "completed" | "pending" | "failed";

export interface DayStatusTask {
  done?: boolean;
  status?: "done" | "completed" | "pending" | "miss" | "failed";
}
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function assertDateKey(value: string, name: string): void {
  if (!DATE_KEY.test(value)) throw new Error(`${name} must use YYYY-MM-DD`);
}
function taskIsCompleted(task: DayStatusTask): boolean {
  return task.done === true || task.status === "done" || task.status === "completed";
}

function taskIsFailed(task: DayStatusTask): boolean {
  return task.status === "miss" || task.status === "failed";
}

/**
 * Resolve a day's status without parsing the date as UTC. ISO local-date keys
 * sort chronologically, so overdue checks stay deterministic at day boundaries.
 */
export function getDayStatus(
  tasks: readonly DayStatusTask[],
  date: string,
  currentDate: string,
): DayStatus {
  assertDateKey(date, "date");
  assertDateKey(currentDate, "currentDate");

  if (tasks.length === 0) return "empty";
  if (tasks.some(taskIsFailed)) return "failed";

  const hasUnfinishedTask = tasks.some((task) => !taskIsCompleted(task));
  if (date < currentDate && hasUnfinishedTask) return "failed";
  if (hasUnfinishedTask || tasks.some((task) => task.status === "pending")) return "pending";
  return "completed";
}

/** Format an instant as a local YYYY-MM-DD key in a named timezone. */
export function dateKeyInTimeZone(
  date = new Date(),
  timeZone = BANGKOK_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getMonthDayStatuses(
  tasksByDay: Readonly<Record<string, readonly DayStatusTask[]>>,
  year: number,
  month: number,
  currentDate = dateKeyInTimeZone(),
): Record<number, DayStatus> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthPart = String(month + 1).padStart(2, "0");
  return Object.fromEntries(
    Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${monthPart}-${String(day).padStart(2, "0")}`;
      return [day, getDayStatus(tasksByDay[date] ?? [], date, currentDate)];
    }),
  );
}

export function summarizeDayStatuses(statuses: Iterable<DayStatus>): Record<Exclude<DayStatus, "empty">, number> {
  const summary = { completed: 0, pending: 0, failed: 0 };
  for (const status of statuses) {
    if (status !== "empty") summary[status] += 1;
  }
  return summary;
}
