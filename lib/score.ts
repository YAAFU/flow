import type { ScheduleItem } from "./types";

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const WAKE_START = 8 * 60, WAKE_END = 24 * 60; // 960 min window

export function busyMin(items: ScheduleItem[]): number {
  return items.reduce((s, it) => {
    let dur = toMin(it.end) - toMin(it.start);
    if (dur < 0) dur += 24 * 60; // crosses midnight
    return s + dur + it.travelFromPrevMin;
  }, 0);
}
export function freeTimeMin(items: ScheduleItem[]): number {
  return Math.max(0, (WAKE_END - WAKE_START) - busyMin(items));
}
export function dayLoadHeat(items: ScheduleItem[]): number {
  return Math.min(1, busyMin(items) / (WAKE_END - WAKE_START));
}

// Transparent control-score: start at 100, subtract explainable penalties.
// Replaces the model's made-up number so the same schedule always scores the same.
export type ScorePart = { label: string; delta: number };
export function controlBreakdown(items: ScheduleItem[], riskPoints: { time: string; reason: string }[]): { score: number; parts: ScorePart[] } {
  const busy = busyMin(items);
  const travel = items.reduce((s, it) => s + it.travelFromPrevMin, 0);
  const loadRatio = busy / (WAKE_END - WAKE_START);
  const parts: ScorePart[] = [];

  const loadPenalty = Math.round(Math.max(0, loadRatio - 0.5) * 60);
  if (loadPenalty > 0) parts.push({ label: `วันแน่น (ใช้เวลา ${Math.round(loadRatio * 100)}% ของวัน)`, delta: -loadPenalty });

  const riskPenalty = Math.min(21, riskPoints.length * 7);
  if (riskPenalty > 0) parts.push({ label: `จุดเสี่ยงเครียด ${riskPoints.length} จุด`, delta: -riskPenalty });

  const travelPenalty = Math.min(15, Math.round(Math.max(0, travel - 60) / 6));
  if (travelPenalty > 0) parts.push({ label: `เดินทางรวม ${travel} นาที`, delta: -travelPenalty });

  const score = Math.max(35, Math.min(98, 100 + parts.reduce((s, p) => s + p.delta, 0)));
  return { score, parts };
}
