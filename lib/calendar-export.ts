import type { FlowState, Task } from "@/lib/types";
import { addDaysToDateKey, combineLocalDateTime, localDateKey, localTimeKey } from "@/lib/time";

function csvCell(value: string | number | boolean | undefined): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function toCsv(state: FlowState): string {
  const header = ["date", "title", "start", "durationMin", "priority", "category", "done", "place", "note"];
  const categoryNames = new Map(state.categories.map((category) => [category.id, category.name]));
  const rows = Object.entries(state.tasksByDay).flatMap(([date, tasks]) => tasks.map((task) => [date, task.title, task.fixedTime, task.durationMin, task.priority, task.categoryId ? categoryNames.get(task.categoryId) : "", task.done, task.place, task.note]));
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function icsEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\n", "\\n");
}

function icsDate(date: string, time?: string): string {
  return `${date.replaceAll("-", "")}${time ? `T${time.replace(":", "")}00` : ""}`;
}

function eventLines(date: string, task: Task): string[] {
  const start = icsDate(date, task.fixedTime);
  const duration = task.durationMin ?? 60;
  const endDate = new Date(combineLocalDateTime(date, task.fixedTime ?? "00:00").getTime() + duration * 60_000);
  const end = task.allDay ? icsDate(addDaysToDateKey(date, 1)) : icsDate(localDateKey(endDate), localTimeKey(endDate));
  return ["BEGIN:VEVENT", `UID:${icsEscape(task.id)}@flow.local`, `DTSTAMP:${new Date().toISOString().replaceAll(/[-:]/g, "").replace(".000", "")}`, `${task.allDay ? "DTSTART;VALUE=DATE" : "DTSTART;TZID=Asia/Bangkok"}:${start}`, `${task.allDay ? "DTEND;VALUE=DATE" : "DTEND;TZID=Asia/Bangkok"}:${end}`, `SUMMARY:${icsEscape(task.title)}`, `LOCATION:${icsEscape(task.place)}`, `DESCRIPTION:${icsEscape(task.note ?? "")}`, "END:VEVENT"];
}

export function toIcs(state: FlowState): string {
  const events = Object.entries(state.tasksByDay).flatMap(([date, tasks]) => tasks.flatMap((task) => eventLines(date, task)));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Flow//Local Planner//TH", "CALSCALE:GREGORIAN", ...events, "END:VCALENDAR"].join("\r\n");
}
