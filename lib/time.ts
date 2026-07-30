export const MINUTES_PER_DAY = 24 * 60;
export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const THAI_WEEKDAY_SHORT = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] as const;
const THAI_MONTH_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] as const;
export const THAI_MONTH_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"] as const;

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

export function localDateKey(date = new Date(), timeZone = BANGKOK_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA-u-ca-gregory", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localTimeKey(date = new Date(), timeZone = BANGKOK_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.hour}:${values.minute}`;
}

export function parseDateKey(value: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function addDaysToDateKey(value: string, amount: number): string {
  const parsed = parseDateKey(value);
  if (!parsed) throw new Error(`Invalid ISO date: ${value}`);
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function formatThaiTaskDate(value: string): string {
  const parsed = parseDateKey(value);
  if (!parsed) return value;
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  return `${THAI_WEEKDAY_SHORT[weekday]} ${parsed.day} ${THAI_MONTH_SHORT[parsed.month - 1]}`;
}

export function formatThaiMonthYear(year: number, monthIndex: number): string {
  return `${THAI_MONTH_FULL[monthIndex]} ${year + 543}`;
}

export function combineLocalDateTime(date: string, time: string): Date {
  if (!parseDateKey(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Invalid Bangkok date/time");
  return new Date(`${date}T${time}:00+07:00`);
}
