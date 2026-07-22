import { durationTable } from "@/lib/osrm";
import { planningContextForModel, type PlanningContext } from "@/lib/planning-context";
import { scheduleDurationMin } from "@/lib/schedule-validation";
import { timeToMinutes } from "@/lib/time";
import type { PlanResult } from "@/lib/types";

export type PlanningConstraints = { dayStart?: string; dayEnd?: string; breakMin?: number };

export type TravelNode = {
  index: number;
  kind: "origin" | "task";
  taskId?: string;
  label: string;
};

export type TravelPlanningContext = {
  status: "available" | "unavailable";
  originIncluded: boolean;
  nodes: TravelNode[];
  durationsMin?: number[][];
  reason?: "not_enough_coordinates" | "route_service_unavailable";
};

type DurationTableProvider = typeof durationTable;

function travelNodesAndCoordinates(context: PlanningContext) {
  const coordinates: { lat: number; lng: number }[] = [];
  const nodes: TravelNode[] = [];

  if (context.startLocation) {
    coordinates.push({ lat: context.startLocation.latitude, lng: context.startLocation.longitude });
    nodes.push({
      index: 0,
      kind: "origin",
      label: context.startLocation.name?.trim() || "จุดเริ่มต้นที่ผู้ใช้เลือก",
    });
  }

  for (const task of context.tasks) {
    if (task.lat == null || task.lng == null) continue;
    coordinates.push({ lat: task.lat, lng: task.lng });
    nodes.push({ index: nodes.length, kind: "task", taskId: task.id, label: task.place || task.title });
  }

  return { coordinates, nodes };
}

export function unavailableTravelPlanningContext(
  context: PlanningContext,
  reason: TravelPlanningContext["reason"] = "route_service_unavailable",
): TravelPlanningContext {
  const { nodes } = travelNodesAndCoordinates(context);
  return {
    status: "unavailable",
    originIncluded: Boolean(context.startLocation),
    nodes,
    reason,
  };
}

export async function buildTravelPlanningContext(
  context: PlanningContext,
  getDurationTable: DurationTableProvider = durationTable,
): Promise<TravelPlanningContext> {
  const { coordinates, nodes } = travelNodesAndCoordinates(context);

  if (coordinates.length < 2) {
    return {
      status: "unavailable",
      originIncluded: Boolean(context.startLocation),
      nodes,
      reason: "not_enough_coordinates",
    };
  }

  const result = await getDurationTable(coordinates);
  if (result.fallback) {
    return unavailableTravelPlanningContext(context);
  }

  return {
    status: "available",
    originIncluded: Boolean(context.startLocation),
    nodes,
    durationsMin: result.durations,
  };
}

const ENERGY_POLICY = {
  low: "ลดความแน่นของงานที่ยืดหยุ่น เพิ่มช่วงพัก และลดการเดินทางย้อนกลับ โดยห้ามตัดหรือละเมิดงานล็อกเวลา",
  medium: "จัดสมดุลระหว่างงาน ช่วงพัก และการเดินทาง โดยรักษางานล็อกเวลา",
  high: "รองรับงานใช้สมาธิหรือจำนวนงานมากขึ้นได้ แต่ยังต้องมีช่วงพักและห้ามละเมิดงานล็อกเวลา",
} as const;

export function buildPlanningPrompt(
  context: PlanningContext,
  travelContext: TravelPlanningContext,
  constraints: PlanningConstraints,
): string {
  const payload = {
    planningContext: planningContextForModel(context),
    constraints: {
      dayStart: constraints.dayStart ?? "08:00",
      dayEnd: constraints.dayEnd ?? "22:00",
      breakMin: constraints.breakMin ?? 0,
    },
    energyPolicy: ENERGY_POLICY[context.energyLevel],
    travelContext,
  };

  return `ข้อมูลวางแผนที่ตรวจสอบแล้ว (JSON):\n${JSON.stringify(payload)}\n
สร้างแผนทั้ง 2 แบบตาม schema โดยใช้ planningContext.date, timezone และ energyLevel เป็นบริบทจริง
- งานใน lockedTimes ต้องคง startTime และ durationMin เดิมทุกแผน
- ถ้า travelContext.status="available" ให้ใช้เฉพาะ durationsMin นี้; node origin คือจุดเริ่มของงานแรก
- ถ้าไม่มี origin ให้เตือนว่าการเดินทางสู่งานแรกไม่แม่นยำ
- ถ้า travelContext.status="unavailable" ให้ travelFromPrevMin=0 และเตือนว่าไม่สามารถคำนวณเวลาเดินทางได้ ห้ามเดาเวลาเดินทาง
- ประเมินเฉพาะ duration งานที่ไม่มีค่า, เติมงานเฉพาะที่จำเป็นจริง และสะท้อนข้อจำกัดใน riskPoints/summary/tip`;
}

export function validateLockedPlan(plan: PlanResult, context: PlanningContext): string[] {
  const issues: string[] = [];
  for (const variantName of ["A", "B"] as const) {
    const scheduleByTask = new Map(plan.plans[variantName].schedule.map((item) => [item.taskId, item]));
    for (const locked of context.lockedTimes) {
      const item = scheduleByTask.get(locked.taskId);
      if (!item) {
        issues.push(`${variantName}:missing:${locked.taskId}`);
        continue;
      }
      if (item.start !== locked.startTime) issues.push(`${variantName}:moved:${locked.taskId}`);
      if (locked.durationMin != null && scheduleDurationMin(item.start, item.end) !== locked.durationMin) {
        issues.push(`${variantName}:duration:${locked.taskId}`);
      }
    }
  }
  return issues;
}

function trustedTravelDuration(
  travelContext: TravelPlanningContext,
  source: TravelNode | undefined,
  destination: TravelNode | undefined,
): number | null {
  if (travelContext.status !== "available" || !travelContext.durationsMin || !source || !destination) return null;
  const duration = travelContext.durationsMin[source.index]?.[destination.index];
  return Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : null;
}

function minutesBetween(from: string, to: string): number {
  // A plan variant represents one planning day. Treat an earlier next start as
  // no usable travel gap (the overlap validator will report the time clash),
  // rather than accidentally interpreting it as a 24-hour overnight window.
  return Math.max(0, timeToMinutes(to) - timeToMinutes(from));
}

/**
 * Treats the server-built route matrix as the only source of travel durations.
 * Model-provided values are always overwritten, and an unresolvable leg becomes
 * zero with an explicit (non-blocking) risk rather than an invented estimate.
 */
export function reconcilePlanTravel(
  plan: PlanResult,
  travelContext: TravelPlanningContext,
  constraints: PlanningConstraints = {},
): PlanResult {
  const origin = travelContext.nodes.find((node) => node.kind === "origin");
  const taskNodes = new Map(
    travelContext.nodes
      .filter((node): node is TravelNode & { taskId: string } => node.kind === "task" && Boolean(node.taskId))
      .map((node) => [node.taskId, node]),
  );
  const plans = { ...plan.plans };

  for (const variantName of ["A", "B"] as const) {
    const variant = plan.plans[variantName];
    const travelRisks: { time: string; reason: string }[] = [];
    const schedule = variant.schedule.map((item, index, items) => {
      const previous = index > 0 ? items[index - 1] : undefined;
      const source = previous ? taskNodes.get(previous.taskId) : origin;
      const destination = taskNodes.get(item.taskId);
      const trustedDuration = trustedTravelDuration(travelContext, source, destination);

      if (trustedDuration == null) {
        travelRisks.push({
          time: item.start,
          reason: `ยังคำนวณเวลาเดินทางไป ${item.title} ไม่ได้ เพราะไม่มีพิกัดหรือข้อมูลเส้นทางของต้นทาง/ปลายทาง`,
        });
        return { ...item, travelFromPrevMin: 0 };
      }

      const availableMin = previous
        ? minutesBetween(previous.end, item.start)
        : minutesBetween(constraints.dayStart ?? "08:00", item.start);
      if (trustedDuration > availableMin) {
        travelRisks.push({
          time: item.start,
          reason: previous
            ? `ช่วงหลัง ${previous.title} มีเวลาเดินทาง ${availableMin} นาที แต่เส้นทางไป ${item.title} ต้องใช้ประมาณ ${trustedDuration} นาที`
            : `จากจุดเริ่มต้นมีเวลาเดินทาง ${availableMin} นาที แต่เส้นทางไป ${item.title} ต้องใช้ประมาณ ${trustedDuration} นาที`,
        });
      }

      return { ...item, travelFromPrevMin: trustedDuration };
    });

    const seen = new Set(variant.riskPoints.map((risk) => `${risk.time}\u0000${risk.reason}`));
    const newRisks = travelRisks.filter((risk) => {
      const key = `${risk.time}\u0000${risk.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const riskPoints = [...variant.riskPoints, ...newRisks];
    plans[variantName] = {
      ...variant,
      schedule,
      riskPoints,
      riskScore: Math.max(variant.riskScore, Math.min(100, riskPoints.length * 20)),
    };
  }

  return { ...plan, plans };
}

export function travelAccuracyWarning(context: PlanningContext, travelContext: TravelPlanningContext): string | null {
  if (!context.startLocation) return "ไม่ได้ระบุจุดเริ่มต้น เวลาเดินทางสู่งานแรกและลำดับการเดินทางอาจไม่แม่นยำ";
  const warnings: string[] = [];
  if (context.startLocation.accuracy != null && context.startLocation.accuracy > 250) {
    warnings.push(`ตำแหน่งเริ่มต้นมีความแม่นยำประมาณ ±${Math.round(context.startLocation.accuracy)} เมตร เวลาเดินทางขาแรกอาจคลาดเคลื่อน`);
  }
  if (travelContext.status === "unavailable") warnings.push("ยังไม่สามารถคำนวณเวลาเส้นทางได้ แผนนี้จึงไม่รวมเวลาเดินทาง");
  return warnings.length ? warnings.join(" ") : null;
}

export function addTravelAccuracyWarning(plan: PlanResult, warning: string | null): PlanResult {
  if (!warning) return plan;
  const plans = { ...plan.plans };
  for (const variantName of ["A", "B"] as const) {
    const variant = plan.plans[variantName];
    const risk = { time: "การเดินทาง", reason: warning };
    const riskPoints = variant.riskPoints.some((item) => item.reason === warning)
      ? variant.riskPoints
      : [...variant.riskPoints, risk];
    plans[variantName] = {
      ...variant,
      riskPoints,
      riskScore: Math.max(variant.riskScore, Math.min(100, riskPoints.length * 20)),
    };
  }
  return {
    ...plan,
    plans,
    summary: plan.summary.includes(warning) ? plan.summary : `${plan.summary} ${warning}`.trim(),
    tip: plan.tip.includes(warning) ? plan.tip : `${plan.tip} ${warning}`.trim(),
  };
}
