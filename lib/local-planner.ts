import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { timeToMinutes } from "@/lib/time";
import type { PlanResult, PlanVariant, ScheduleItem, Task } from "@/lib/types";
import { addOverlapWarnings, findScheduleOverlaps } from "@/lib/schedule-validation";

const DAY_MINUTES = 24 * 60;
const DEFAULT_START = 8 * 60;
const DEFAULT_DURATION = 60;
const PRIORITY_ORDER: Record<Task["priority"], number> = { urgent: 0, high: 1, normal: 2, flex: 3 };

export type LocalPlannerOptions = { dayStart?: string; dayEnd?: string; breakMin?: number };

type Placement = { task: Task; start: number; end: number };

function minuteLabel(value: number): string {
  const normalized = ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function durationFor(task: Task): number {
  return Math.max(15, Math.min(DAY_MINUTES, task.durationMin ?? DEFAULT_DURATION));
}
function nextAvailableStart(preferred: number, duration: number, placed: Placement[], bufferMin: number): number {
  let candidate = Math.max(0, preferred);
  const occupied = [...placed].sort((left, right) => left.start - right.start);

  for (let attempt = 0; attempt <= occupied.length; attempt += 1) {
    const conflict = occupied.find((slot) =>
      candidate < slot.end + bufferMin && candidate + duration > slot.start - bufferMin,
    );
    if (!conflict) return candidate;
    candidate = conflict.end + bufferMin;
  }

  return candidate;
}

function createSchedule(tasks: Task[], bufferMin: number, defaultStart: number): ScheduleItem[] {
  const locked = tasks
    .filter((task) => task.lockTime && task.fixedTime)
    .map((task) => {
      const start = timeToMinutes(task.fixedTime!);
      return { task, start, end: start + durationFor(task) };
    });

  const movable = tasks
    .filter((task) => !(task.lockTime && task.fixedTime))
    .sort((left, right) => {
      const leftTime = left.fixedTime ? timeToMinutes(left.fixedTime) : defaultStart;
      const rightTime = right.fixedTime ? timeToMinutes(right.fixedTime) : defaultStart;
      return leftTime - rightTime || PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] || (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id);
    });

  const placed = [...locked];
  for (const task of movable) {
    const duration = durationFor(task);
    const preferred = task.fixedTime ? timeToMinutes(task.fixedTime) : defaultStart;
    const start = nextAvailableStart(preferred, duration, placed, bufferMin);
    placed.push({ task, start, end: start + duration });
  }

  return placed
    .sort((left, right) => left.start - right.start || PRIORITY_ORDER[left.task.priority] - PRIORITY_ORDER[right.task.priority] || left.task.id.localeCompare(right.task.id))
    .map(({ task, start, end }) => ({
      taskId: task.id,
      title: task.title,
      placeLabel: task.place,
      start: minuteLabel(start),
      end: minuteLabel(end),
      travelFromPrevMin: 0,
      aiAdded: false,
    }));
}

function createVariant(tasks: Task[], bufferMin: number, dayStart: number, dayEnd: number): PlanVariant {
  const schedule = createSchedule(tasks, bufferMin, dayStart);
  const overlaps = findScheduleOverlaps(schedule);
  const busy = schedule.reduce((total, item) => total + Math.max(15, (() => {
    const start = timeToMinutes(item.start);
    let end = timeToMinutes(item.end);
    if (end <= start) end += DAY_MINUTES;
    return end - start;
  })()), 0);
  const densityRisk = Math.max(0, Math.round(((busy - 10 * 60) / (10 * 60)) * 40));
  const riskScore = Math.min(100, overlaps.length * 25 + densityRisk);
  const riskPoints = busy > 16 * 60
    ? [{ time: "ทั้งวัน", reason: "เวลารวมของงานยาวเกินช่วงตื่นปกติ ควรแบ่งหรือลดงานก่อนยืนยัน" }]
    : [];
  for (const item of schedule) {
    const start = timeToMinutes(item.start);
    let end = timeToMinutes(item.end);
    if (end <= start) end += DAY_MINUTES;
    if (start < dayStart || end > dayEnd) riskPoints.push({ time: `${item.start}–${item.end}`, reason: `${item.title} อยู่นอกช่วงวันที่กำหนด กรุณาตรวจสอบเวลา` });
  }
  const controlScore = controlBreakdown(schedule, riskPoints).score;

  return { schedule, controlScore, freeTimeMin: freeTimeMin(schedule), riskScore: Math.max(riskScore, Math.min(100, riskPoints.length * 20)), riskPoints };
}

/**
 * Deterministic, server-safe fallback. It never invents tasks and keeps every
 * incoming task id exactly once in both plan variants.
 */
export function buildLocalPlan(tasks: Task[], options: LocalPlannerOptions = {}): PlanResult {
  const parsedStart = options.dayStart ? timeToMinutes(options.dayStart) : DEFAULT_START;
  const rawEnd = options.dayEnd ? timeToMinutes(options.dayEnd) : 22 * 60;
  const parsedEnd = rawEnd <= parsedStart ? rawEnd + DAY_MINUTES : rawEnd;
  const breakMin = Math.max(0, Math.min(240, Math.round(options.breakMin ?? 0)));
  const base: PlanResult = {
    plans: {
      A: createVariant(tasks, breakMin, parsedStart, parsedEnd),
      B: createVariant(tasks, Math.min(240, breakMin + 15), parsedStart, parsedEnd),
    },
    summary: "กำลังใช้โหมดจัดแผนในเครื่อง ระบบเรียงงานจากเวลา ความสำคัญ และช่วงว่างโดยไม่ส่งข้อมูลไปยัง AI",
    tip: "ตรวจเวลาและจุดที่อาจทับกันในฉบับร่างก่อนกดยืนยัน",
    mode: "local",
  };
  const warned = addOverlapWarnings(base);

  for (const variantName of ["A", "B"] as const) {
    const variant = warned.plans[variantName];
    variant.controlScore = controlBreakdown(variant.schedule, variant.riskPoints).score;
  }

  return warned;
}
