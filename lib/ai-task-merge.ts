import type { ParsedTaskDraft } from "@/lib/ai-parse";
import { scheduleDurationMin } from "@/lib/schedule-validation";
import { TaskSchema, type Category, type ScheduleItem, type Task } from "@/lib/types";

export type PersistablePlannerDraft = ParsedTaskDraft & { draftId: string };

export function plannerDraftTaskId(draftId: string): string {
  return `ai-draft-${draftId}`;
}
function categoryFor(draft: PersistablePlannerDraft, categories: Category[]): string | undefined {
  const name = draft.categoryName?.trim().toLocaleLowerCase("th-TH");
  if (!name) return undefined;
  return categories.find((category) => category.name.trim().toLocaleLowerCase("th-TH") === name)?.id;
}
export function plannerDraftToTask(
  draft: PersistablePlannerDraft,
  order: number,
  categories: Category[],
  now: string,
): Task {
  return TaskSchema.parse({
    id: plannerDraftTaskId(draft.draftId),
    title: draft.title.trim(),
    place: draft.place.trim(),
    fixedTime: draft.allDay ? undefined : draft.fixedTime,
    durationMin: draft.durationMin,
    allDay: draft.allDay,
    lockTime: false,
    deadlineDate: draft.deadlineDate,
    deadlineTime: draft.deadlineTime,
    priority: draft.priority,
    categoryId: categoryFor(draft, categories),
    reminderOffsets: draft.reminderOffsets,
    order,
    done: false,
    aiAdded: true,
    needsReview: draft.needsReview,
    note: draft.note,
    createdAt: now,
    updatedAt: now,
  });
}

export function appendPlannerDrafts(
  existing: Task[],
  drafts: PersistablePlannerDraft[],
  categories: Category[],
  now: string,
): Task[] {
  const existingIds = new Set(existing.map((task) => task.id));
  const additions = drafts.map((draft, index) => plannerDraftToTask(draft, existing.length + index, categories, now));
  for (const task of additions) {
    if (existingIds.has(task.id)) throw new Error("พบงานฉบับร่างซ้ำ กรุณาสร้างฉบับร่างใหม่");
    existingIds.add(task.id);
  }
  return [...existing, ...additions];
}

export function mergeScheduleIntoTasks({
  existing,
  drafts,
  schedule,
  categories,
  now,
  createId,
}: {
  existing: Task[];
  drafts: PersistablePlannerDraft[];
  schedule: ScheduleItem[];
  categories: Category[];
  now: string;
  createId: () => string;
}): { tasks: Task[]; includedDrafts: PersistablePlannerDraft[] } {
  const existingById = new Map(existing.map((task) => [task.id, task]));
  const draftsById = new Map(drafts.map((draft) => [plannerDraftTaskId(draft.draftId), draft]));
  const seen = new Set<string>();
  const includedDraftIds = new Set<string>();

  const scheduled = schedule.map((item, order) => {
    const stableId = item.taskId.trim();
    if (stableId && seen.has(stableId)) throw new Error("แผนมีงานซ้ำ กรุณาจัดแผนใหม่");
    if (stableId) seen.add(stableId);

    const existingTask = stableId ? existingById.get(stableId) : undefined;
    const draft = stableId ? draftsById.get(stableId) : undefined;
    if (!existingTask && !draft && !item.aiAdded) throw new Error("แผนมีงานที่ไม่ตรงกับข้อมูลปัจจุบัน กรุณาจัดแผนใหม่");

    const base = existingTask
      ?? (draft ? plannerDraftToTask(draft, order, categories, now) : TaskSchema.parse({
        id: createId(), title: item.title.trim(), place: item.placeLabel.trim(), priority: "normal",
        aiAdded: true, order, createdAt: now, updatedAt: now,
      }));
    if (draft) includedDraftIds.add(draft.draftId);

    const title = item.title.trim();
    if (!title) throw new Error("ชื่องานในแผนต้องไม่ว่าง");
    return TaskSchema.parse({
      ...base,
      title,
      place: item.placeLabel.trim() || base.place,
      fixedTime: item.start,
      durationMin: scheduleDurationMin(item.start, item.end),
      allDay: false,
      order,
      aiAdded: base.aiAdded || item.aiAdded || undefined,
      updatedAt: now,
    });
  });

  const untouched = existing.filter((task) => !seen.has(task.id));
  return {
    tasks: [...scheduled, ...untouched],
    includedDrafts: drafts.filter((draft) => includedDraftIds.has(draft.draftId)),
  };
}
