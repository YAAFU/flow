import {
  AppSettingsSchema,
  ActiveFocusSessionSchema,
  CategorySchema,
  DayMetaSchema,
  FlowStateSchema,
  FocusSessionSchema,
  RecentPlaceSchema,
  RecurrenceRuleSchema,
  ReminderLogSchema,
  SavedPlaceSchema,
  type FlowState,
  type StoredTask,
  TaskSchema,
} from "@/lib/types";
import { localDateKey, parseDateKey } from "@/lib/time";

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
    savedPlaces: [],
    recentPlaces: [],
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

const LEGACY_TIME_KEYS = ["startTime", "start", "endTime", "end"] as const;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function firstValidTime(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && TIME_PATTERN.test(value));
}

function legacyDurationMin(start: string | undefined, end: string | undefined): number | undefined {
  if (!start || !end || start === end) return undefined;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const duration = endTotal >= startTotal ? endTotal - startTotal : (24 * 60) - startTotal + endTotal;
  return duration > 0 && duration <= 24 * 60 ? duration : undefined;
}

function safeLegacyCoordinates(value: JsonRecord): { lat?: number; lng?: number } {
  const lat = typeof value.lat === "number" && Number.isFinite(value.lat) && value.lat >= -90 && value.lat <= 90 ? value.lat : undefined;
  const lng = typeof value.lng === "number" && Number.isFinite(value.lng) && value.lng >= -180 && value.lng <= 180 ? value.lng : undefined;
  return lat != null && lng != null ? { lat, lng } : {};
}

function safeLegacyLocationSource(value: unknown) {
  return value === "search" || value === "quick" || value === "map" || value === "live" || value === "manual"
    || value === "saved" || value === "suggested" || value === "recent" ? value : undefined;
}

function hasLegacyTaskTimes(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.tasksByDay)) return false;
  return Object.values(value.tasksByDay).some((tasks) => Array.isArray(tasks) && tasks.some((task) =>
    isRecord(task) && LEGACY_TIME_KEYS.some((key) => key in task),
  ));
}

function normalizeLegacyTask(value: unknown, date: string, order: number, now: string): StoredTask | null {
  if (!isRecord(value) || typeof value.title !== "string" || !value.title.trim()) return null;
  const priority = value.priority === "urgent" || value.priority === "high" || value.priority === "flex" ? value.priority : "normal";
  const fixedTime = firstValidTime(value.fixedTime, value.startTime, value.start);
  const endTime = firstValidTime(value.endTime, value.end);
  const coordinates = safeLegacyCoordinates(value);
  const hasCoordinates = coordinates.lat != null && coordinates.lng != null;
  const existingDuration = typeof value.durationMin === "number" && Number.isFinite(value.durationMin) && value.durationMin > 0
    ? Math.min(24 * 60, Math.max(1, Math.round(value.durationMin)))
    : undefined;
  // Consume recognized legacy aliases so migration is idempotent while
  // retaining unrelated metadata from older or future clients.
  const preserved = Object.fromEntries(
    Object.entries(value).filter(([key]) => !LEGACY_TIME_KEYS.includes(key as (typeof LEGACY_TIME_KEYS)[number])),
  );
  const candidate = {
    ...preserved,
    id: typeof value.id === "string" ? value.id : stableId("task", `${date}-${order}-${value.title}`),
    title: value.title.trim(),
    place: typeof value.place === "string" ? value.place : "",
    lat: coordinates.lat,
    lng: coordinates.lng,
    locationSource: hasCoordinates ? safeLegacyLocationSource(value.locationSource) : undefined,
    locationAccuracy: hasCoordinates && typeof value.locationAccuracy === "number" && Number.isFinite(value.locationAccuracy) && value.locationAccuracy >= 0 && value.locationAccuracy <= 100_000 ? value.locationAccuracy : undefined,
    locationCapturedAt: hasCoordinates && typeof value.locationCapturedAt === "string" && Number.isFinite(Date.parse(value.locationCapturedAt)) ? new Date(value.locationCapturedAt).toISOString() : undefined,
    priority,
    fixedTime,
    durationMin: existingDuration ?? legacyDurationMin(fixedTime, endTime),
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
  // A nominally valid v2 state can still contain legacy start/end aliases, so
  // normalize those tasks before parsing it and consume the aliases once.
  if (hasLegacyTaskTimes(value) && isRecord(value) && isRecord(value.tasksByDay)) {
    const iso = now.toISOString();
    const tasksByDay = Object.fromEntries(Object.entries(value.tasksByDay).map(([date, tasks]) => [
      date,
      Array.isArray(tasks)
        ? tasks.map((task, order) => normalizeLegacyTask(task, date, order, iso) ?? task)
        : tasks,
    ]));
    const normalizedCurrent = FlowStateSchema.safeParse({ ...value, tasksByDay });
    if (normalizedCurrent.success) return normalizedCurrent.data;
  }

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
  const recurrenceRules = Array.isArray(value.recurrenceRules)
    ? value.recurrenceRules.map((item) => RecurrenceRuleSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data)
    : base.recurrenceRules;
  const dayMetaByDay: FlowState["dayMetaByDay"] = {};
  if (isRecord(value.dayMetaByDay)) {
    for (const [date, meta] of Object.entries(value.dayMetaByDay)) {
      const parsed = DayMetaSchema.safeParse(meta);
      if (parsed.success && parseDateKey(date)) dayMetaByDay[date] = parsed.data;
    }
  }
  const focusSessions = Array.isArray(value.focusSessions)
    ? value.focusSessions.map((item) => FocusSessionSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data)
    : base.focusSessions;
  const savedPlaces = Array.isArray(value.savedPlaces)
    ? value.savedPlaces.map((item) => SavedPlaceSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data)
    : base.savedPlaces;
  const recentPlaces = Array.isArray(value.recentPlaces)
    ? value.recentPlaces.map((item) => RecentPlaceSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data)
    : base.recentPlaces;
  const activeFocusSession = ActiveFocusSessionSchema.safeParse(value.activeFocusSession);
  const reminderLog = Array.isArray(value.reminderLog)
    ? value.reminderLog.map((item) => ReminderLogSchema.safeParse(item)).filter((result) => result.success).map((result) => result.data)
    : base.reminderLog;
  return FlowStateSchema.parse({
    ...value,
    ...base,
    tasksByDay,
    categories: categories.length ? categories : base.categories,
    recurrenceRules,
    dayMetaByDay,
    focusSessions,
    activeFocusSession: activeFocusSession.success ? activeFocusSession.data : undefined,
    savedPlaces,
    recentPlaces,
    settings: settings.success ? settings.data : base.settings,
    reminderLog,
    selectedDate: typeof value.selectedDate === "string" && parseDateKey(value.selectedDate) ? value.selectedDate : base.selectedDate,
    updatedAt: typeof value.updatedAt === "string" && Number.isFinite(Date.parse(value.updatedAt)) ? new Date(value.updatedAt).toISOString() : base.updatedAt,
  });
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
  if (currentRaw) {
    const parsed = parseJson(currentRaw);
    if (isRecord(parsed)) return migrateState(parsed, now);
  }
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
  const savedPlaces = new Map(current.savedPlaces.map((place) => [place.id, place]));
  incoming.savedPlaces.forEach((place) => savedPlaces.set(place.id, place));
  const recentPlaces = new Map(current.recentPlaces.map((place) => [place.placeKey, place]));
  incoming.recentPlaces.forEach((place) => {
    const existing = recentPlaces.get(place.placeKey);
    if (!existing || Date.parse(place.lastUsedAt) >= Date.parse(existing.lastUsedAt)) recentPlaces.set(place.placeKey, place);
  });
  return FlowStateSchema.parse({
    ...current,
    tasksByDay,
    categories: [...categories.values()],
    savedPlaces: [...savedPlaces.values()],
    recentPlaces: [...recentPlaces.values()].sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt)).slice(0, 5),
    updatedAt: new Date().toISOString(),
  });
}

export function clearState(storage: StorageLike): void {
  storage.removeItem(STATE_KEY);
}
