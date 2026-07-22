import { MINUTES_PER_DAY, parseDateKey, timeToMinutes } from "@/lib/time";
import { createTask, type NewTaskInput } from "@/lib/task-factory";
import { TaskSchema, type Priority, type Task } from "@/lib/types";

export type RepeatFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

export interface RepeatDraft {
  frequency: RepeatFrequency;
}

/**
 * Presentation-independent task form state. Location is deliberately supplied
 * separately when building a task so the same form rules can be reused with a
 * text field, search picker, map pin, or live location.
 */
export interface TaskFormDraft {
  title: string;
  timeSet: boolean;
  time: string;
  lockTime: boolean;
  durationSet: boolean;
  durationHours: number;
  durationMinutes: number;
  priority: Priority;
  categoryId: string;
  deadlineDate: string;
  deadlineTime: string;
  repeat: RepeatDraft;
  reminderOffsets: number[];
  allDay: boolean;
  note: string;
}

export interface CalculatedEndTime {
  time: string;
  dayOffset: number;
  label: string;
}

export interface ValidatedTaskForm {
  fields: NewTaskInput;
  repeat: RepeatDraft;
}

export type TaskFormValidationResult =
  | { success: true; value: ValidatedTaskForm }
  | { success: false; error: string };

export interface BuildTaskFromFormOptions {
  editing?: Task | null;
  order?: number;
  now?: Date;
  /** Location and other non-form fields owned by the caller. */
  additionalFields?: Partial<NewTaskInput>;
}

const PRIORITIES = new Set<Priority>(["urgent", "high", "normal", "flex"]);
const REPEAT_FREQUENCIES = new Set<RepeatFrequency>(["none", "daily", "weekly", "monthly", "yearly"]);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTaskTitleValid(title: string): boolean {
  return title.trim().length > 0;
}

export function validateStartTime(enabled: boolean, time: string): { fixedTime?: string; error?: string } {
  if (!enabled) return {};
  if (!TIME_PATTERN.test(time)) return { error: "กรุณาเลือกเวลาเริ่ม" };
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
  return deriveCalculatedEndTime(start, durationMin)?.label ?? "";
}

/** Derives display-only end time. The task source of truth remains start + duration. */
export function deriveCalculatedEndTime(start: string | undefined, durationMin: number | undefined): CalculatedEndTime | undefined {
  if (!start || !TIME_PATTERN.test(start)) return undefined;
  if (durationMin == null || !Number.isInteger(durationMin) || durationMin <= 0 || durationMin > MINUTES_PER_DAY) return undefined;
  const total = timeToMinutes(start) + durationMin;
  const dayOffset = Math.floor(total / MINUTES_PER_DAY);
  const normalized = total % MINUTES_PER_DAY;
  const time = `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
  return { time, dayOffset, label: dayOffset > 0 ? `วันถัดไป ${time}` : time };
}

export function taskToFormDraft(task?: Task | null, repeat: RepeatDraft = { frequency: "none" }): TaskFormDraft {
  const durationMin = task?.durationMin;
  const fixedTime = task?.allDay ? undefined : task?.fixedTime;
  return {
    title: task?.title ?? "",
    timeSet: Boolean(fixedTime),
    time: fixedTime ?? "",
    lockTime: Boolean(fixedTime && task?.lockTime),
    durationSet: durationMin != null,
    durationHours: durationMin == null ? 0 : Math.floor(durationMin / 60),
    durationMinutes: durationMin == null ? 0 : durationMin % 60,
    priority: task?.priority ?? "normal",
    categoryId: task?.categoryId ?? "",
    deadlineDate: task?.deadlineDate ?? "",
    deadlineTime: task?.deadlineTime ?? "",
    repeat: { ...repeat },
    reminderOffsets: [...(task?.reminderOffsets ?? [])],
    allDay: Boolean(task?.allDay),
    note: task?.note ?? "",
  };
}

export function validateTaskFormDraft(draft: TaskFormDraft): TaskFormValidationResult {
  const title = draft.title.trim();
  if (!title) return { success: false, error: "กรุณากรอกชื่องาน" };
  if (!PRIORITIES.has(draft.priority)) return { success: false, error: "ความสำคัญไม่ถูกต้อง" };
  if (!REPEAT_FREQUENCIES.has(draft.repeat.frequency)) return { success: false, error: "รูปแบบการทำซ้ำไม่ถูกต้อง" };

  const start = validateStartTime(!draft.allDay && draft.timeSet, draft.time);
  if (start.error) return { success: false, error: start.error };
  const duration = validateDuration(draft.durationSet, draft.durationHours, draft.durationMinutes);
  if (duration.error) return { success: false, error: duration.error };

  const reminders = [...new Set(draft.reminderOffsets)];
  if (reminders.some((value) => !Number.isInteger(value) || value < 0 || value > 10080)) {
    return { success: false, error: "เวลาแจ้งเตือนไม่ถูกต้อง" };
  }

  const deadlineDate = draft.deadlineDate.trim() || undefined;
  const deadlineTime = deadlineDate ? draft.deadlineTime.trim() || undefined : undefined;
  if (deadlineDate && !parseDateKey(deadlineDate)) return { success: false, error: "วันที่เส้นตายไม่ถูกต้อง" };
  if (deadlineTime && !TIME_PATTERN.test(deadlineTime)) return { success: false, error: "เวลาเส้นตายไม่ถูกต้อง" };
  return {
    success: true,
    value: {
      fields: {
        title,
        fixedTime: start.fixedTime,
        durationMin: duration.durationMin,
        lockTime: Boolean(start.fixedTime) && draft.lockTime,
        allDay: draft.allDay,
        deadlineDate,
        deadlineTime,
        priority: draft.priority,
        categoryId: draft.categoryId.trim() || undefined,
        reminderOffsets: reminders.sort((left, right) => left - right),
        note: draft.note,
      },
      repeat: { ...draft.repeat },
    },
  };
}

export function buildTaskFromFormDraft(
  draft: TaskFormDraft,
  options: BuildTaskFromFormOptions = {},
): { task: Task; repeat: RepeatDraft } {
  const validated = validateTaskFormDraft(draft);
  if (!validated.success) throw new Error(validated.error);
  const now = options.now ?? new Date();
  const fields: NewTaskInput = { ...options.additionalFields, ...validated.value.fields };
  const task = options.editing
    ? TaskSchema.parse({
      ...options.editing,
      ...fields,
      id: options.editing.id,
      createdAt: options.editing.createdAt ?? now.toISOString(),
      updatedAt: now.toISOString(),
    })
    : createTask(fields, options.order ?? 0, now);
  return { task, repeat: validated.value.repeat };
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
