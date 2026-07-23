import { mergeScheduleIntoTasks, plannerDraftToTask } from "@/lib/ai-task-merge";
import { buildLocalPlan } from "@/lib/local-planner";
import { lockedTimesFromTasks } from "@/lib/planning-context";
import { FlowStateSchema, PlanResultSchema, TaskSchema } from "@/lib/types";
import type { DayEnergy, FlowState, PlanResult, Task } from "@/lib/types";
import type { PlannerDraftTask, PlanVariantName } from "@/components/planner/AIPlannerDialog";

export type GuidePlanSettings = {
  date: string;
  dayStart: string;
  dayEnd: string;
  energy: DayEnergy;
  breakMin?: number;
};

export function guideDraftsToTasks(
  drafts: readonly PlannerDraftTask[],
  state: FlowState,
  now = new Date(),
): Task[] {
  const iso = now.toISOString();
  const offset = state.tasksByDay[state.selectedDate]?.length ?? 0;
  return drafts.map((draft, index) =>
    TaskSchema.parse(plannerDraftToTask(draft, offset + index, state.categories, iso)),
  );
}

export function buildGuidePlanningContext(
  tasks: readonly Task[],
  settings: GuidePlanSettings,
) {
  return {
    date: settings.date,
    timezone: "Asia/Bangkok",
    energyLevel: settings.energy,
    tasks: [...tasks],
    lockedTimes: lockedTimesFromTasks([...tasks]),
  };
}

export function buildLocalGuidePlan(
  tasks: readonly Task[],
  settings: GuidePlanSettings,
): PlanResult {
  return PlanResultSchema.parse(buildLocalPlan([...tasks], {
    dayStart: settings.dayStart,
    dayEnd: settings.dayEnd,
    breakMin: settings.breakMin ?? 30,
    energyLevel: settings.energy,
  }));
}

export function applyGuidePlan(
  state: FlowState,
  input: {
    settings: GuidePlanSettings;
    drafts: readonly PlannerDraftTask[];
    plan: PlanResult;
    variant: PlanVariantName;
    now?: Date;
    createId?: () => string;
  },
): FlowState {
  const now = input.now ?? new Date();
  const iso = now.toISOString();
  const date = input.settings.date;
  const existing = state.tasksByDay[date] ?? [];
  const merged = mergeScheduleIntoTasks({
    existing,
    drafts: [...input.drafts],
    schedule: input.plan.plans[input.variant].schedule,
    categories: state.categories,
    now: iso,
    createId: input.createId ?? (() => `guide-plan-${crypto.randomUUID()}`),
  });

  return FlowStateSchema.parse({
    ...state,
    selectedDate: date,
    tasksByDay: {
      ...state.tasksByDay,
      [date]: merged.tasks.map((task) => TaskSchema.parse(task)),
    },
    dayMetaByDay: {
      ...state.dayMetaByDay,
      [date]: {
        date,
        energy: input.settings.energy,
        note: state.dayMetaByDay[date]?.note ?? "",
      },
    },
    updatedAt: iso,
  });
}
