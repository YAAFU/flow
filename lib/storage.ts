import {
  AppSettingsSchema,
  CategorySchema,
  FlowStateSchema,
  type FlowState,
  type StoredTask,
  TaskSchema,
} from "@/lib/types";
import { localDateKey } from "@/lib/time";

export const STATE_KEY = "flow_state_v2";
export const LEGACY_TASKS_KEY = "flow_tasks_v1";
export const BACKUP_KEY = "flow_state_backup_v1";

const DEFAULT_CATEGORY_NAMES = ["เรียน", "งาน", "ส่วนตัว", "สุขภาพ", "โปรเจกต์"];

function stableId(prefix: string, value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}

export function createDefaultState(now = new Date()): FlowState {
  const iso = now.toISOString();
  return {
    schemaVersion: 2,
    tasksByDay: {},
    categories: DEFAULT_CATEGORY_NAMES.map((name) => ({ id: stableId("category", name), name, createdAt: iso })),
    recurrenceRules: [],
    dayMetaByDay: {},
    focusSessions: [],
    settings: AppSettingsSchema.parse({}),
    reminderLog: [],
    selectedDate: localDateKey(now),
    updatedAt: iso,
  };
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLegacyTask(value: unknown, date: string, order: number, now: string): StoredTask | null {
  if (!isRecord(value) || typeof value.title !== "string" || !value.title.trim()) return null;
  const priority = value.priority === "high" || value.priority === "flex" ? value.priority : "normal";
  const candidate = {
    ...value,
    id: typeof value.id === "string" ? value.id : stableId("task", `${date}-${order}-${value.title}`),
    title: value.title.trim(),
    place: typeof value.place === "string" ? value.place : "",
    priority,
    durationMin: typeof value.durationMin === "number" ? Math.max(15, Math.round(value.durationMin)) : undefined,
    allDay: value.allDay === true,
    lockTime: value.lockTime === true,
    reminderOffsets: Array.isArray(value.reminderOffsets) ? value.reminderOffsets : [],
    order: typeof value.order === "number" ? Math.round(value.order) : order,
    done: value.done === true,
    aiAdded: value.aiAdded === true,
    needsReview: value.needsReview === true,
    note: typeof value.note === "string" ? value.note : "",
    movedCount: typeof value.movedCount === "number" ? Math.max(0, Math.round(value.movedCount)) : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
  const parsed = TaskSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function migrateState(value: unknown, now = new Date()): FlowState {
  const current = FlowStateSchema.safeParse(value);
  if (current.success) return current.data;

  const base = createDefaultState(now);
  if (!isRecord(value)) return base;
  const source = isRecord(value.tasksByDay) ? value.tasksByDay : value;
  const iso = now.toISOString();
  const tasksByDay: FlowState["tasksByDay"] = {};
  for (const [date, tasks] of Object.entries(source)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(tasks)) continue;
    const safe = tasks.map((task, order) => normalizeLegacyTask(task, date, order, iso)).filter((task): task is StoredTask => task !== null);
    if (safe.length) tasksByDay[date] = safe;
  }

  const categories = Array.isArray(value.categories)
    ? value.categories.map((category) => CategorySchema.safeParse(category)).filter((result) => result.success).map((result) => result.data)
    : base.categories;
  const settings = AppSettingsSchema.safeParse(value.settings);
  return {
    ...base,
    tasksByDay,
    categories: categories.length ? categories : base.categories,
    settings: settings.success ? settings.data : base.settings,
    selectedDate: typeof value.selectedDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.selectedDate) ? value.selectedDate : base.selectedDate,
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

export function loadState(storage: StorageLike, now = new Date()): FlowState {
  const currentRaw = storage.getItem(STATE_KEY);
  if (currentRaw) return migrateState(parseJson(currentRaw), now);
  const legacyRaw = storage.getItem(LEGACY_TASKS_KEY);
  if (!legacyRaw) return createDefaultState(now);
  storage.setItem(BACKUP_KEY, legacyRaw);
  const migrated = migrateState(parseJson(legacyRaw), now);
  storage.setItem(STATE_KEY, JSON.stringify(migrated));
  return migrated;
}

export function saveState(storage: StorageLike, state: FlowState): FlowState {
  const validated = FlowStateSchema.parse({ ...state, updatedAt: new Date().toISOString() });
  storage.setItem(STATE_KEY, JSON.stringify(validated));
  return validated;
}

export function exportState(state: FlowState): string {
  return JSON.stringify({ ...FlowStateSchema.parse(state), exportedAt: new Date().toISOString(), appVersion: "0.1.0" }, null, 2);
}

export function importState(raw: string, current: FlowState, mode: "merge" | "replace"): FlowState {
  const incoming = migrateState(parseJson(raw));
  if (mode === "replace") return incoming;
  const tasksByDay = { ...current.tasksByDay };
  for (const [date, tasks] of Object.entries(incoming.tasksByDay)) {
    const byId = new Map((tasksByDay[date] ?? []).map((task) => [task.id, task]));
    tasks.forEach((task) => byId.set(task.id, task));
    tasksByDay[date] = [...byId.values()].sort((a, b) => a.order - b.order);
  }
  const categories = new Map(current.categories.map((category) => [category.id, category]));
  incoming.categories.forEach((category) => categories.set(category.id, category));
  return FlowStateSchema.parse({ ...current, tasksByDay, categories: [...categories.values()], updatedAt: new Date().toISOString() });
}

export function clearState(storage: StorageLike): void {
  storage.removeItem(STATE_KEY);
}
