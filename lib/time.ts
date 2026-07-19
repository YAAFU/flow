export const MINUTES_PER_DAY = 24 * 60;

export function timeToMinutes(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function minutesToTime(value: number): string {
  const normalized = Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(value)));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

export function snapMinutes(value: number, step = 15): number {
  return Math.round(value / step) * step;
}

export function endTime(start: string, durationMin: number): string {
  return minutesToTime(timeToMinutes(start) + durationMin);
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function combineLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}
