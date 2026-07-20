import { MINUTES_PER_DAY, timeToMinutes } from "@/lib/time";

export function isTaskTitleValid(title: string): boolean {
  return title.trim().length > 0;
}

export function validateStartTime(enabled: boolean, time: string): { fixedTime?: string; error?: string } {
  if (!enabled) return {};
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: "กรุณาเลือกเวลาเริ่ม" };
  return { fixedTime: time };
}

export function validateDuration(enabled: boolean, hours: number, minutes: number): { durationMin?: number; error?: string } {
  if (!enabled) return {};
  if (!Number.isInteger(hours) || hours < 0) return { error: "ชั่วโมงต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" };
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return { error: "นาทีต้องอยู่ระหว่าง 0–59" };
  const durationMin = hours * 60 + minutes;
  if (durationMin <= 0) return { error: "ระยะเวลาต้องมากกว่า 0 นาที" };
  if (durationMin > MINUTES_PER_DAY) return { error: "ระยะเวลาต้องไม่เกิน 24 ชั่วโมง" };
  return { durationMin };
}

export function estimatedFinish(start: string, durationMin: number): string {
  const total = timeToMinutes(start) + durationMin;
  const normalized = ((total % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const time = `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  return total >= MINUTES_PER_DAY ? `วันถัดไป ${time}` : time;
}

export interface SubmitGuard {
  tryLock(): boolean;
  release(): void;
  isLocked(): boolean;
}

export function createSubmitGuard(): SubmitGuard {
  let locked = false;
  return {
    tryLock() {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() { locked = false; },
    isLocked() { return locked; },
  };
}
