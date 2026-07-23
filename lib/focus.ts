import { localDateKey, timeToMinutes } from "@/lib/time";
import type { ActiveFocusSession, FocusMode, FocusOutcome, FocusSession, Task } from "@/lib/types";

export type FocusTaskContext = {
  task?: Task;
  nextTask?: Task;
  nextLockedTask?: Task;
  remainingTaskMin?: number;
  recommendedMin: number;
  maxSafeMin?: number;
  safeUntil?: string;
  reason: string;
  hasNextLockedTask: boolean;
};

function bangkokMinuteOfDay(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function taskStartMinute(task: Task, focusDate: string): number | undefined {
  if (!task.fixedTime) return undefined;
  const start = timeToMinutes(task.fixedTime);
  return task.occurrenceDate && task.occurrenceDate < focusDate ? start - 24 * 60 : start;
}

function taskEndMinute(task: Task, focusDate: string): number | undefined {
  if (!task.fixedTime || task.durationMin == null) return undefined;
  return taskStartMinute(task, focusDate)! + task.durationMin;
}

function focusedMinutes(taskId: string, sessions: readonly FocusSession[], date: string): number {
  return sessions
    .filter((session) => session.taskId === taskId && (!session.date || session.date === date))
    .reduce((total, session) => total + (session.actualMin ?? 0), 0);
}

export function selectFocusContext(
  tasks: readonly Task[],
  sessions: readonly FocusSession[],
  date: string,
  now = new Date(),
  breakBufferMin = 10,
): FocusTaskContext {
  if (date !== localDateKey(now)) {
    return { recommendedMin: 25, reason: "เลือกวันที่วันนี้เพื่อเริ่มงานตาม Timeline", hasNextLockedTask: false };
  }
  const minuteNow = bangkokMinuteOfDay(now);
  const eligible = tasks.filter((task) => !task.done);
  const scheduled = eligible
    .filter((task) => !task.allDay && task.fixedTime)
    .sort((left, right) => taskStartMinute(left, date)! - taskStartMinute(right, date)!);
  const current = scheduled.find((task) => {
    const start = taskStartMinute(task, date)!;
    const end = taskEndMinute(task, date);
    return start <= minuteNow && (end == null ? minuteNow - start <= 60 : minuteNow < end);
  });
  const started = scheduled.find((task) => taskStartMinute(task, date)! <= minuteNow && (taskEndMinute(task, date) ?? minuteNow + 1) > minuteNow);
  const nextFlexible = scheduled.find((task) => {
    const start = taskStartMinute(task, date)!;
    return start > minuteNow && !task.lockTime && start - minuteNow <= 120;
  });
  const unscheduled = eligible
    .filter((task) => !task.fixedTime && !task.allDay)
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))[0];
  const task = current ?? started ?? nextFlexible ?? unscheduled;
  if (!task) return { recommendedMin: 25, reason: "ยังไม่มีงานที่พร้อมเริ่ม", hasNextLockedTask: false };

  const taskStart = task.fixedTime ? taskStartMinute(task, date)! : minuteNow;
  const nextTask = scheduled.find((candidate) => candidate.id !== task.id && taskStartMinute(candidate, date)! > Math.max(minuteNow, taskStart));
  const nextLocked = scheduled.find((candidate) => candidate.id !== task.id && candidate.lockTime && taskStartMinute(candidate, date)! > minuteNow);
  const focused = focusedMinutes(task.id, sessions, date);
  const remainingFromEstimate = task.durationMin == null ? undefined : Math.max(1, task.durationMin - focused);
  const scheduledEnd = taskEndMinute(task, date);
  const remainingFromTimeline = scheduledEnd == null ? undefined : Math.max(1, scheduledEnd - minuteNow);
  const remainingTaskMin = remainingFromEstimate == null
    ? remainingFromTimeline
    : remainingFromTimeline == null
      ? remainingFromEstimate
      : Math.min(remainingFromEstimate, remainingFromTimeline);
  const safeBeforeLocked = nextLocked
    ? Math.max(0, taskStartMinute(nextLocked, date)! - minuteNow - breakBufferMin - (nextLocked.travelFromPrevMin ?? 0))
    : undefined;
  const baseline = remainingTaskMin ?? 25;
  const recommendedMin = Math.max(0, Math.min(240, baseline, safeBeforeLocked ?? 240));
  const safeUntil = nextLocked?.fixedTime;
  const reason = nextLocked && safeBeforeLocked === 0
    ? `ยังไม่มีช่วงโฟกัสที่ปลอดภัยก่อน ${nextLocked.title} เวลา ${nextLocked.fixedTime}${nextLocked.travelFromPrevMin ? ` (เผื่อเดินทาง ${nextLocked.travelFromPrevMin} นาที)` : ""}`
    : nextLocked && safeBeforeLocked != null && safeBeforeLocked < baseline
    ? `แนะนำ ${recommendedMin} นาที เพื่อให้ทันงานถัดไปเวลา ${nextLocked.fixedTime}${nextLocked.travelFromPrevMin ? ` และเดินทาง ${nextLocked.travelFromPrevMin} นาที` : ""}`
    : remainingTaskMin != null
      ? `เหลือเวลาตามแผนประมาณ ${remainingTaskMin} นาที`
      : "งานนี้ยังไม่มีระยะเวลาประเมิน ใช้ค่าโฟกัสปกติได้";
  return {
    task,
    nextTask,
    nextLockedTask: nextLocked,
    remainingTaskMin,
    recommendedMin,
    maxSafeMin: safeBeforeLocked,
    safeUntil,
    reason,
    hasNextLockedTask: Boolean(nextLocked),
  };
}

export function elapsedFocusMs(active: ActiveFocusSession, now = new Date()): number {
  const effectiveNow = active.pausedAt ? new Date(active.pausedAt).getTime() : now.getTime();
  return Math.max(0, effectiveNow - new Date(active.startedAt).getTime() - active.pausedMs);
}

export function canExtendFocus(
  active: ActiveFocusSession,
  tasks: readonly Task[],
  now = new Date(),
  extensionMin = 5,
  breakBufferMin = 10,
): { allowed: boolean; reason?: string } {
  const minuteNow = bangkokMinuteOfDay(now);
  const nextLocked = tasks
    .filter((task) => !task.done && task.lockTime && task.fixedTime && task.id !== active.taskId)
    .sort((left, right) => taskStartMinute(left, active.date ?? localDateKey(now))! - taskStartMinute(right, active.date ?? localDateKey(now))!)
    .find((task) => taskStartMinute(task, active.date ?? localDateKey(now))! > minuteNow);
  if (!nextLocked) return { allowed: true };
  const remainingSessionMin = Math.max(0, Math.ceil((active.plannedMin * 60_000 - elapsedFocusMs(active, now)) / 60_000));
  const safeMin = taskStartMinute(nextLocked, active.date ?? localDateKey(now))! - minuteNow - breakBufferMin - (nextLocked.travelFromPrevMin ?? 0);
  return remainingSessionMin + extensionMin <= safeMin
    ? { allowed: true }
    : { allowed: false, reason: `เพิ่มเวลาไม่ได้ เพราะมี ${nextLocked.title} เวลา ${nextLocked.fixedTime}` };
}

export function finishFocusSession(
  active: ActiveFocusSession,
  outcome: FocusOutcome,
  now = new Date(),
): FocusSession {
  return {
    id: active.id,
    taskId: active.taskId,
    date: active.date,
    mode: active.mode,
    startedAt: active.startedAt,
    endedAt: now.toISOString(),
    plannedMin: active.plannedMin,
    actualMin: Math.max(0, Math.round(elapsedFocusMs(active, now) / 60_000)),
    completed: outcome === "completed",
    outcome,
    createdAt: active.startedAt,
  };
}

export function preferredFocusMode(
  sessions: readonly FocusSession[],
  fallback: FocusMode = "pomodoro",
): FocusMode {
  return [...sessions].reverse().find((session) => session.mode)?.mode ?? fallback;
}
