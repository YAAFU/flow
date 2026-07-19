import type { RecurrenceRule, Task } from "@/lib/types";
import { localDateKey } from "@/lib/time";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function monthsBetween(start: Date, current: Date): number {
  return (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
}

export function matchesRecurrence(dateKey: string, rule: RecurrenceRule): boolean {
  if (dateKey < rule.startDate || (rule.endDate && dateKey > rule.endDate) || rule.excludedDates.includes(dateKey)) return false;
  const start = new Date(`${rule.startDate}T12:00:00`);
  const current = new Date(`${dateKey}T12:00:00`);
  const days = Math.round((current.getTime() - start.getTime()) / 86_400_000);
  if (days < 0) return false;
  if (rule.frequency === "daily") return days % rule.interval === 0;
  if (rule.frequency === "weekly") {
    const week = Math.floor(days / 7);
    const weekdays = rule.weekdays.length ? rule.weekdays : [start.getDay()];
    return week % rule.interval === 0 && weekdays.includes(current.getDay());
  }
  if (rule.frequency === "monthly") {
    const day = rule.monthDay ?? start.getDate();
    return monthsBetween(start, current) % rule.interval === 0 && current.getDate() === day;
  }
  const years = current.getFullYear() - start.getFullYear();
  return years % rule.interval === 0 && current.getMonth() === start.getMonth() && current.getDate() === start.getDate();
}

export function occurrencesForRange(template: Task, rule: RecurrenceRule, from: string, to: string): Task[] {
  const results: Task[] = [];
  let cursor = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  let matched = 0;
  while (cursor <= end) {
    const date = localDateKey(cursor);
    if (matchesRecurrence(date, rule)) {
      matched += 1;
      if (!rule.count || matched <= rule.count) {
        results.push({ ...template, id: `${template.id}@${date}`, seriesId: rule.id, occurrenceDate: date, originalDate: date });
      }
    }
    cursor = addDays(cursor, 1);
  }
  return results;
}

export function mergeOccurrences(existing: Task[], generated: Task[]): Task[] {
  const seen = new Set(existing.map((task) => `${task.seriesId ?? task.id}:${task.occurrenceDate ?? ""}`));
  return [...existing, ...generated.filter((task) => {
    const key = `${task.seriesId ?? task.id}:${task.occurrenceDate ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  })];
}
