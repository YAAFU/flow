import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { timeToMinutes } from "@/lib/time";
import type { PlanningStartLocation } from "@/lib/planning-context";
import type { TravelPlanningContext } from "@/lib/planning-route";
import type { DayEnergy, PlanResult, PlanVariant, ScheduleItem, Task } from "@/lib/types";
import { addOverlapWarnings, findScheduleOverlaps } from "@/lib/schedule-validation";

const DAY_MINUTES = 24 * 60;
const DEFAULT_START = 8 * 60;
const DEFAULT_DURATION = 60;
const PRIORITY_ORDER: Record<Task["priority"], number> = { urgent: 0, high: 1, normal: 2, flex: 3 };

export type LocalPlannerOptions = {
  dayStart?: string;
  dayEnd?: string;
  breakMin?: number;
  energyLevel?: DayEnergy;
  startLocation?: PlanningStartLocation;
  travelContext?: TravelPlanningContext;
};

type Placement = { task: Task; start: number; end: number };

function minuteLabel(value: number): string {
  const normalized = ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}
function durationFor(task: Task): number {
  return Math.max(15, Math.min(DAY_MINUTES, task.durationMin ?? DEFAULT_DURATION));
}

type Coordinate = { latitude: number; longitude: number };

function taskCoordinate(task: Task): Coordinate | null {
  return task.lat == null || task.lng == null ? null : { latitude: task.lat, longitude: task.lng };
}

function distanceKm(left: Coordinate, right: Coordinate): number {
  const radians = (value: number) => value * Math.PI / 180;
  const earthRadiusKm = 6_371;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(haversine));
}

function stableTaskOrder(left: Task, right: Task): number {
  return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority]
    || (left.order ?? 0) - (right.order ?? 0)
    || left.id.localeCompare(right.id);
}

function orderFlexibleTasks(tasks: Task[], startLocation?: PlanningStartLocation): Task[] {
  if (!startLocation) return [...tasks].sort(stableTaskOrder);
  const remaining = [...tasks];
  const ordered: Task[] = [];
  let cursor: Coordinate = { latitude: startLocation.latitude, longitude: startLocation.longitude };

  while (remaining.length) {
    remaining.sort((left, right) => {
      const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
      if (priority) return priority;
      const leftCoordinate = taskCoordinate(left);
      const rightCoordinate = taskCoordinate(right);
      const leftDistance = leftCoordinate ? distanceKm(cursor, leftCoordinate) : Number.POSITIVE_INFINITY;
      const rightDistance = rightCoordinate ? distanceKm(cursor, rightCoordinate) : Number.POSITIVE_INFINITY;
      return leftDistance - rightDistance || stableTaskOrder(left, right);
    });
    const next = remaining.shift()!;
    ordered.push(next);
    cursor = taskCoordinate(next) ?? cursor;
  }

  return ordered;
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

function createSchedule(tasks: Task[], bufferMin: number, defaultStart: number, startLocation?: PlanningStartLocation): ScheduleItem[] {
  const locked = tasks
    .filter((task) => task.lockTime && task.fixedTime)
    .map((task) => {
      const start = timeToMinutes(task.fixedTime!);
      return { task, start, end: start + durationFor(task) };
    });

  const movableTasks = tasks.filter((task) => !(task.lockTime && task.fixedTime));
  const preferred = movableTasks
    .filter((task) => task.fixedTime)
    .sort((left, right) => timeToMinutes(left.fixedTime!) - timeToMinutes(right.fixedTime!) || stableTaskOrder(left, right));
  const flexible = orderFlexibleTasks(movableTasks.filter((task) => !task.fixedTime), startLocation);
  const movable = [...preferred, ...flexible];

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

function applyTravelMatrix(
  schedule: ScheduleItem[],
  tasks: Task[],
  dayStart: number,
  dayEnd: number,
  travelContext?: TravelPlanningContext,
): { schedule: ScheduleItem[]; riskPoints: { time: string; reason: string }[] } {
  if (travelContext?.status !== "available" || !travelContext.durationsMin) {
    return { schedule, riskPoints: [] };
  }

  const origin = travelContext.nodes.find((node) => node.kind === "origin");
  const taskNodes = new Map(travelContext.nodes.flatMap((node) => node.kind === "task" && node.taskId ? [[node.taskId, node] as const] : []));
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const riskPoints: { time: string; reason: string }[] = [];
  const crossesMidnight = dayEnd > DAY_MINUTES;

  const remaining = schedule
    .map((item, index) => {
      let start = timeToMinutes(item.start);
      if (crossesMidnight && start < dayStart) start += DAY_MINUTES;
      let end = timeToMinutes(item.end);
      while (end <= start) end += DAY_MINUTES;
      const task = tasksById.get(item.taskId);
      return {
        item,
        index,
        start,
        duration: end - start,
        locked: Boolean(task?.lockTime && task.fixedTime),
      };
    })
    .sort((left, right) => left.start - right.start || left.index - right.index);

  const arranged: ScheduleItem[] = [];
  let previousEnd = dayStart;
  let previousTaskId: string | null = null;

  const routeMinutes = (sourceTaskId: string | null, destinationTaskId: string, title: string, reportRisk: boolean) => {
    const source = sourceTaskId == null ? origin : taskNodes.get(sourceTaskId);
    const destination = taskNodes.get(destinationTaskId);
    const rawDuration = source && destination
      ? travelContext.durationsMin?.[source.index]?.[destination.index]
      : undefined;

    if (!source || !destination) {
      if (reportRisk) {
        const missing = [
          !source ? (sourceTaskId == null ? "จุดเริ่มต้น" : "พิกัดงานก่อนหน้า") : null,
          !destination ? `พิกัดของ ${title}` : null,
        ].filter(Boolean).join("และ");
        riskPoints.push({
          time: "การเดินทาง",
          reason: `ยังไม่สามารถคำนวณเวลาเดินทางไป ${title} ได้ เพราะไม่มี${missing}`,
        });
      }
      return 0;
    }

    if (rawDuration == null || !Number.isFinite(rawDuration) || rawDuration < 0) {
      if (reportRisk) {
        riskPoints.push({
          time: "การเดินทาง",
          reason: `ยังไม่สามารถคำนวณเวลาเดินทางไป ${title} ได้ เพราะข้อมูลเส้นทางของช่วงนี้ไม่ครบ`,
        });
      }
      return 0;
    }

    return Math.round(rawDuration);
  };

  while (remaining.length) {
    let recordIndex = 0;
    const candidate = remaining[0];

    if (!candidate.locked) {
      const nextLockedIndex = remaining.findIndex((record) => record.locked);
      if (nextLockedIndex > 0) {
        const nextLocked = remaining[nextLockedIndex];
        const travelToCandidate = routeMinutes(previousTaskId, candidate.item.taskId, candidate.item.title, false);
        const candidateStart = Math.max(candidate.start, previousEnd + travelToCandidate);
        const travelToLocked = routeMinutes(candidate.item.taskId, nextLocked.item.taskId, nextLocked.item.title, false);

        // Do not shift flexible work across a fixed appointment while retaining
        // the old array predecessor. Defer it and calculate the route again from
        // the locked appointment after that appointment has been emitted.
        if (candidateStart + candidate.duration + travelToLocked > nextLocked.start) {
          recordIndex = nextLockedIndex;
        }
      }
    }

    const [record] = remaining.splice(recordIndex, 1);
    const travelFromPrevMin = routeMinutes(previousTaskId, record.item.taskId, record.item.title, true);
    const earliestStart = previousEnd + travelFromPrevMin;
    let absoluteStart = record.start;

    if (record.locked) {
      if (absoluteStart < earliestStart) {
        const shortfall = earliestStart - absoluteStart;
        riskPoints.push({
          time: `${minuteLabel(previousEnd)}–${record.item.start}`,
          reason: `${record.item.title} ล็อกเวลา ${record.item.start} ไว้ แต่เวลาเดินทางตามเส้นทางต้องใช้ ${travelFromPrevMin} นาที ทำให้ไปไม่ทัน ${shortfall} นาที ระบบจึงไม่เลื่อนงานที่ล็อก`,
        });
      }
    } else {
      absoluteStart = Math.max(absoluteStart, earliestStart);
    }

    const absoluteEnd = absoluteStart + record.duration;
    arranged.push({
      ...record.item,
      start: minuteLabel(absoluteStart),
      end: minuteLabel(absoluteEnd),
      travelFromPrevMin,
    });
    previousEnd = Math.max(previousEnd, absoluteEnd);
    previousTaskId = record.item.taskId;
  }

  return { schedule: arranged, riskPoints };
}

function createVariant(
  tasks: Task[],
  bufferMin: number,
  dayStart: number,
  dayEnd: number,
  travelWarning: string | null,
  startLocation?: PlanningStartLocation,
  travelContext?: TravelPlanningContext,
): PlanVariant {
  const baseSchedule = createSchedule(tasks, bufferMin, dayStart, startLocation);
  const travel = applyTravelMatrix(baseSchedule, tasks, dayStart, dayEnd, travelContext);
  const schedule = travel.schedule;
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
  if (travelWarning) riskPoints.push({ time: "การเดินทาง", reason: travelWarning });
  riskPoints.push(...travel.riskPoints);
  for (const item of schedule) {
    let start = timeToMinutes(item.start);
    if (dayEnd > DAY_MINUTES && start < dayStart) start += DAY_MINUTES;
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
  const requestedBreakMin = Math.max(0, Math.min(240, Math.round(options.breakMin ?? 0)));
  const energyLevel = options.energyLevel ?? "medium";
  const energyAdjustment = energyLevel === "low" ? 15 : energyLevel === "high" ? -15 : 0;
  const breakMin = Math.max(0, Math.min(240, requestedBreakMin + energyAdjustment));
  const hasRealTravel = options.travelContext?.status === "available" && Boolean(options.travelContext.durationsMin);
  const routeWarning = hasRealTravel
    ? options.travelContext?.originIncluded
      ? null
      : "ไม่ได้ระบุจุดเริ่มต้น เวลาเดินทางสู่งานแรกอาจไม่แม่นยำ แม้จะคำนวณเส้นทางระหว่างงานที่มีพิกัดแล้ว"
    : options.startLocation
      ? "ใช้พิกัดเพื่อจัดกลุ่มงานที่ยืดหยุ่นและอยู่ใกล้กันแล้ว แต่ Local Planner ยังไม่สามารถคำนวณเวลาเส้นทางได้"
      : "ไม่ได้ระบุจุดเริ่มต้น จึงยังไม่สามารถคำนวณเวลาเดินทางและลำดับการเดินทางอาจไม่แม่นยำ";
  const accuracyWarning = options.startLocation?.accuracy != null && options.startLocation.accuracy > 250
    ? `ตำแหน่งเริ่มต้นมีความแม่นยำประมาณ ${Math.round(options.startLocation.accuracy)} เมตร เวลาเดินทางอาจคลาดเคลื่อน`
    : null;
  const travelWarning = [routeWarning, accuracyWarning].filter((warning) => warning != null).join(" ") || null;
  const energySummary = energyLevel === "low"
    ? "พลังงานน้อย: เพิ่มช่วงว่างระหว่างงานเพื่อลดความแน่นของวัน"
    : energyLevel === "high"
      ? "พลังงานมาก: ลดช่วงว่างของงานที่ยืดหยุ่น แต่ยังตรึงงานที่ล็อกเวลาไว้"
      : "พลังงานกลาง: รักษาสมดุลระหว่างงานและช่วงพัก";
  const base: PlanResult = {
    plans: {
      A: createVariant(tasks, breakMin, parsedStart, parsedEnd, travelWarning, options.startLocation, options.travelContext),
      B: createVariant(tasks, Math.min(240, breakMin + 15), parsedStart, parsedEnd, travelWarning, options.startLocation, options.travelContext),
    },
    summary: `กำลังใช้โหมดจัดแผนในเครื่อง ${energySummary} ระบบไม่ส่งข้อมูลไปยัง AI และ${hasRealTravel ? "ใช้เวลาประมาณจากบริการ routing เมื่อมีพิกัด" : "ยังไม่รวมเวลาเดินทาง"}`,
    tip: travelWarning ?? "รวมเวลาประมาณจากจุดเริ่มต้นและระหว่างงานที่มีพิกัดแล้ว โปรดตรวจสภาพการเดินทางจริงอีกครั้ง",
    mode: "local",
  };
  const warned = addOverlapWarnings(base);

  for (const variantName of ["A", "B"] as const) {
    const variant = warned.plans[variantName];
    variant.controlScore = controlBreakdown(variant.schedule, variant.riskPoints).score;
  }

  return warned;
}
