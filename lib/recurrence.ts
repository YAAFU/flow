import type { RecurrenceRule, Task } from "@/lib/types";
import { addDaysToDateKey, parseDateKey } from "@/lib/time";

export function matchesRecurrence(dateKey: string, rule: RecurrenceRule): boolean {
  if (dateKey < rule.startDate || (rule.endDate && dateKey > rule.endDate) || rule.excludedDates.includes(dateKey)) return false;
  const startParts = parseDateKey(rule.startDate);
  const currentParts = parseDateKey(dateKey);
  if (!startParts || !currentParts) return false;
  const start = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
  const current = Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day);
  const days = Math.round((current - start) / 86_400_000);
  if (days < 0) return false;
  if (rule.frequency === "daily") return days % rule.interval === 0;
  if (rule.frequency === "weekly") {
    const week = Math.floor(days / 7);
    const startWeekday = new Date(start).getUTCDay();
    const currentWeekday = new Date(current).getUTCDay();
    const weekdays = rule.weekdays.length ? rule.weekdays : [startWeekday];
    return week % rule.interval === 0 && weekdays.includes(currentWeekday);
  }
  if (rule.frequency === "monthly") {
    const day = rule.monthDay ?? startParts.day;
    const months = (currentParts.year - startParts.year) * 12 + currentParts.month - startParts.month;
    return months % rule.interval === 0 && currentParts.day === day;
  }
  const years = currentParts.year - startParts.year;
  return years % rule.interval === 0 && currentParts.month === startParts.month && currentParts.day === startParts.day;
}

export function occurrencesForRange(template: Task, rule: RecurrenceRule, from: string, to: string): Task[] {
  const results: Task[] = [];
  let cursor = from;
  let matched = 0;
  while (cursor <= to) {
    if (matchesRecurrence(cursor, rule)) {
      matched += 1;
      if (!rule.count || matched <= rule.count) {
        results.push({ ...template, id: `${template.id}@${cursor}`, seriesId: rule.id, occurrenceDate: cursor, originalDate: cursor });
      }
    }
    cursor = addDaysToDateKey(cursor, 1);
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
