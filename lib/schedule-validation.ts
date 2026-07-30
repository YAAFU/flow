import { timeToMinutes } from "@/lib/time";
import type { PlanResult, ScheduleItem, Task } from "@/lib/types";

export type ScheduleOverlap = {
  firstIndex: number;
  secondIndex: number;
  firstTaskId: string;
  secondTaskId: string;
  overlapMin: number;
  start: string;
  end: string;
};

type Interval = {
  index: number;
  item: ScheduleItem;
  start: number;
  end: number;
};

function minuteLabel(value: number): string {
  const normalized = ((value % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function intervalFor(item: ScheduleItem, index: number): Interval {
  const start = timeToMinutes(item.start);
  let end = timeToMinutes(item.end);
  if (end <= start) end += 24 * 60;
  return { index, item, start, end };
}
/** Returns the duration of a schedule item, including an item that crosses midnight. */
export function scheduleDurationMin(start: string, end: string): number {
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

/** Pure pairwise overlap detection. Adjacent items (end === start) do not conflict. */
export function findScheduleOverlaps(items: ScheduleItem[]): ScheduleOverlap[] {
  const intervals = items.map(intervalFor);
  const overlaps: ScheduleOverlap[] = [];

  for (let left = 0; left < intervals.length; left += 1) {
    for (let right = left + 1; right < intervals.length; right += 1) {
      const first = intervals[left];
      const second = intervals[right];
      const overlapStart = Math.max(first.start, second.start);
      const overlapEnd = Math.min(first.end, second.end);
      if (overlapStart >= overlapEnd) continue;
      overlaps.push({
        firstIndex: first.index,
        secondIndex: second.index,
        firstTaskId: first.item.taskId,
        secondTaskId: second.item.taskId,
        overlapMin: overlapEnd - overlapStart,
        start: minuteLabel(overlapStart),
        end: minuteLabel(overlapEnd),
      });
    }
  }

  return overlaps;
}

/** Ensures an AI plan contains every existing task exactly once in each variant. */
export function validatePlanTaskCoverage(plan: PlanResult, tasks: Task[]): string[] {
  const expected = new Set(tasks.map((task) => task.id));
  const issues: string[] = [];

  for (const variantName of ["A", "B"] as const) {
    const counts = new Map<string, number>();
    for (const item of plan.plans[variantName].schedule) {
      if (!item.taskId) continue;
      if (!expected.has(item.taskId)) {
        issues.push(`${variantName}:unknown:${item.taskId}`);
        continue;
      }
      counts.set(item.taskId, (counts.get(item.taskId) ?? 0) + 1);
    }
    for (const id of expected) {
      const count = counts.get(id) ?? 0;
      if (count !== 1) issues.push(`${variantName}:${count === 0 ? "missing" : "duplicate"}:${id}`);
    }
  }

  return issues;
}

/** Adds honest, user-readable conflict warnings without mutating the parsed plan. */
export function addOverlapWarnings(plan: PlanResult): PlanResult {
  const plans = { ...plan.plans };

  for (const variantName of ["A", "B"] as const) {
    const variant = plan.plans[variantName];
    const overlaps = findScheduleOverlaps(variant.schedule);
    if (!overlaps.length) continue;

    const conflictRisks = overlaps.map((overlap) => {
      const first = variant.schedule[overlap.firstIndex];
      const second = variant.schedule[overlap.secondIndex];
      return {
        time: `${overlap.start}–${overlap.end}`,
        reason: `เวลา ${first.title} ทับกับ ${second.title} ${overlap.overlapMin} นาที ต้องตรวจสอบก่อนใช้แผน`,
      };
    });
    const seen = new Set(variant.riskPoints.map((risk) => `${risk.time}\u0000${risk.reason}`));
    const newRisks = conflictRisks.filter((risk) => {
      const key = `${risk.time}\u0000${risk.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    plans[variantName] = {
      ...variant,
      riskScore: Math.max(variant.riskScore, Math.min(100, overlaps.length * 25)),
      riskPoints: [...variant.riskPoints, ...newRisks],
    };
  }

  return { ...plan, plans };
}
