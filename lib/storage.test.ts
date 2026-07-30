import { describe, expect, it } from "vitest";
import { BACKUP_KEY, LEGACY_TASKS_KEY, STATE_KEY, createDefaultState, exportState, importState, loadState, migrateState, saveState, type StorageLike } from "@/lib/storage";
import { createTask } from "@/lib/task-factory";
import { addTaskToDate } from "@/lib/task-state";

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("storage migration", () => {
  it("backs up and migrates flow_tasks_v1 without losing high priority", () => {
    const storage = new MemoryStorage();
    const legacy = { "2026-07-19": [{ id: "a", title: "งานเดิม", place: "", priority: "high", fixedTime: "09:00" }] };
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify(legacy));
    const state = loadState(storage, new Date("2026-07-19T00:00:00.000Z"));
    expect(state.tasksByDay["2026-07-19"][0]).toMatchObject({ id: "a", priority: "high", order: 0 });
    expect(storage.getItem(BACKUP_KEY)).toBe(JSON.stringify(legacy));
    expect(storage.getItem(STATE_KEY)).toBeTruthy();
  });

  it("salvages valid records and skips malformed tasks", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({ "2026-07-19": [{ title: "ใช้ได้", priority: "normal" }, { bad: true }] }));
    expect(loadState(storage).tasksByDay["2026-07-19"]).toHaveLength(1);
  });

  it("migrates the legacy wrapper and preserves its selected date and optional fields", () => {
    const storage = new MemoryStorage();
    const legacy = { selectedDate: "2026-07-21", tasksByDay: { "2026-07-21": [{ id: "old", title: " งานเดิม ", place: "สยาม", lat: 13.746, lng: 100.534, priority: "urgent", durationMin: 9999 }] } };
    const raw = JSON.stringify(legacy);
    storage.setItem(LEGACY_TASKS_KEY, raw);
    const state = loadState(storage, new Date("2026-07-20T00:00:00.000Z"));
    expect(state.selectedDate).toBe("2026-07-21");
    expect(state.tasksByDay["2026-07-21"][0]).toMatchObject({ id: "old", title: "งานเดิม", priority: "urgent", lat: 13.746, lng: 100.534, durationMin: 1440 });
    expect(storage.getItem(BACKUP_KEY)).toBe(raw);
  });

  it("preserves a legacy task while discarding invalid location metadata", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({
      "2026-07-21": [{
        id: "bad-location",
        title: "งานเดิมต้องอยู่",
        priority: "normal",
        place: "ชื่อที่ผู้ใช้เคยกรอก",
        lat: 999,
        lng: 100.5,
        locationSource: "live",
        locationAccuracy: -1,
      }],
    }));
    const task = loadState(storage).tasksByDay["2026-07-21"][0];
    expect(task).toMatchObject({ id: "bad-location", title: "งานเดิมต้องอยู่", place: "ชื่อที่ผู้ใช้เคยกรอก" });
    expect(task.lat).toBeUndefined();
    expect(task.lng).toBeUndefined();
    expect(task.locationSource).toBeUndefined();
  });

  it("falls back to valid legacy data when the current JSON is corrupt", () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, "{broken");
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({ "2026-07-21": [{ id: "safe", title: "ยังอยู่", priority: "normal" }] }));
    expect(loadState(storage).tasksByDay["2026-07-21"][0].id).toBe("safe");
  });

  it("keeps valid planner metadata while salvaging a partial v2 state", () => {
    const storage = new MemoryStorage();
    const timestamp = "2026-07-20T00:00:00.000Z";
    storage.setItem(STATE_KEY, JSON.stringify({
      schemaVersion: 2,
      tasksByDay: {},
      recurrenceRules: [{ id: "rule", taskId: "task", frequency: "daily", interval: 1, startDate: "2026-07-20", excludedDates: [], createdAt: timestamp, updatedAt: timestamp }],
      dayMetaByDay: { "2026-07-20": { date: "2026-07-20", energy: "high", note: "พร้อม" } },
      focusSessions: [{ id: "focus", mode: "free", startedAt: timestamp, plannedMin: 25 }],
      activeFocusSession: { id: "active-focus", mode: "pomodoro", startedAt: timestamp, plannedMin: 25 },
      settings: { theme: "dark", defaultFocusMode: "long", focusBreakBufferMin: 20, integrationSetting: "keep" },
      reminderLog: [{ id: "notice", taskId: "task", occurrenceDate: "2026-07-20", offsetMin: 10, notifiedAt: timestamp }],
      integrationMetadata: { keepDuringSalvage: true },
      selectedDate: "2026-07-20",
      updatedAt: timestamp,
    }));
    const state = loadState(storage);
    expect(state.recurrenceRules).toHaveLength(1);
    expect(state.dayMetaByDay["2026-07-20"].energy).toBe("high");
    expect(state.reminderLog).toHaveLength(1);
    expect(state.schemaVersion).toBe(3);
    expect(state.settings).toMatchObject({ theme: "dark", integrationSetting: "keep" });
    expect(state).not.toHaveProperty("focusSessions");
    expect(state).not.toHaveProperty("activeFocusSession");
    expect(state.settings).not.toHaveProperty("defaultFocusMode");
    expect(state.settings).not.toHaveProperty("focusBreakBufferMin");
    expect((state as unknown as Record<string, unknown>).integrationMetadata).toEqual({ keepDuringSalvage: true });
  });

  it("can add and reload a new task without replacing migrated tasks", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({ "2026-07-21": [{ id: "old", title: "งานเดิม", priority: "normal" }] }));
    const migrated = loadState(storage, new Date("2026-07-20T00:00:00.000Z"));
    const next = { ...migrated, tasksByDay: addTaskToDate(migrated.tasksByDay, "2026-07-21", createTask({ title: "งานใหม่" }, 1, new Date("2026-07-20T01:00:00.000Z"))) };
    saveState(storage, next);
    expect(loadState(storage).tasksByDay["2026-07-21"].map((task) => task.title)).toEqual(["งานเดิม", "งานใหม่"]);
  });

  it("round-trips every field from the complete add-task flow", () => {
    const storage = new MemoryStorage();
    const state = createDefaultState(new Date("2026-07-20T00:00:00.000Z"));
    const detailed = createTask({ title: "ประชุมทีม", place: "สยาม", lat: 13.746, lng: 100.534, fixedTime: "13:00", durationMin: 60, lockTime: true, priority: "high" }, 0, new Date("2026-07-20T01:00:00.000Z"));
    saveState(storage, { ...state, selectedDate: "2026-07-21", tasksByDay: addTaskToDate(state.tasksByDay, "2026-07-21", detailed) });
    expect(loadState(storage).tasksByDay["2026-07-21"][0]).toMatchObject({ title: "ประชุมทีม", place: "สยาม", lat: 13.746, lng: 100.534, fixedTime: "13:00", durationMin: 60, lockTime: true, priority: "high" });
  });

  it("normalizes legacy start/end aliases in an otherwise valid v2 state before Zod strips them", () => {
    const storage = new MemoryStorage();
    const current = createDefaultState(new Date("2026-07-20T00:00:00.000Z"));
    storage.setItem(STATE_KEY, JSON.stringify({
      ...current,
      tasksByDay: {
        "2026-07-21": [{ id: "legacy-time", title: "เรียน", place: "", priority: "normal", startTime: "13:00", endTime: "15:00" }],
      },
    }));
    expect(loadState(storage).tasksByDay["2026-07-21"][0]).toMatchObject({ fixedTime: "13:00", durationMin: 120 });
  });

  it("derives a legacy duration across midnight", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({
      "2026-07-21": [{ id: "overnight", title: "เดินทาง", priority: "normal", start: "23:30", end: "01:00" }],
    }));
    expect(loadState(storage).tasksByDay["2026-07-21"][0]).toMatchObject({ fixedTime: "23:30", durationMin: 90 });
  });

  it("does not invent a duration from an invalid or ambiguous legacy end time", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({
      "2026-07-21": [
        { id: "invalid-end", title: "งานหนึ่ง", priority: "normal", startTime: "09:00", endTime: "25:00" },
        { id: "same-end", title: "งานสอง", priority: "normal", startTime: "09:00", endTime: "09:00" },
      ],
    }));
    const tasks = loadState(storage).tasksByDay["2026-07-21"];
    expect(tasks[0]).toMatchObject({ fixedTime: "09:00", durationMin: undefined });
    expect(tasks[1]).toMatchObject({ fixedTime: "09:00", durationMin: undefined });
  });

  it("keeps an existing valid duration instead of replacing it from legacy end time", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TASKS_KEY, JSON.stringify({
      "2026-07-21": [{ id: "existing-duration", title: "ประชุม", priority: "normal", fixedTime: "10:00", endTime: "12:00", durationMin: 45 }],
    }));
    expect(loadState(storage).tasksByDay["2026-07-21"][0]).toMatchObject({ fixedTime: "10:00", durationMin: 45 });
  });

  it("preserves unknown task metadata and migrates legacy aliases idempotently", () => {
    const now = new Date("2026-07-20T00:00:00.000Z");
    const current = createDefaultState(now);
    const first = migrateState({
      ...current,
      tasksByDay: {
        "2026-07-21": [{
          id: "future-task",
          title: "ข้อมูลจากเวอร์ชันอื่น",
          priority: "normal",
          startTime: "23:30",
          endTime: "01:00",
          integrationMetadata: { provider: "future-client", opaqueId: "keep-me" },
        }],
      },
    }, now);
    const second = migrateState(first, now);
    const task = first.tasksByDay["2026-07-21"][0] as Record<string, unknown>;
    expect(task).toMatchObject({ fixedTime: "23:30", durationMin: 90, integrationMetadata: { opaqueId: "keep-me" } });
    expect(task).not.toHaveProperty("startTime");
    expect(task).not.toHaveProperty("endTime");
    expect(second).toEqual(first);
  });

  it("adds smart-place defaults, removes legacy Focus data, and stays idempotent", () => {
    const now = new Date("2026-07-23T00:00:00.000Z");
    const legacyV2 = {
      ...createDefaultState(now),
      schemaVersion: 2,
      savedPlaces: undefined,
      recentPlaces: undefined,
      focusSessions: [{ id: "focus-old", taskId: "task", mode: "pomodoro", startedAt: now.toISOString(), plannedMin: 25, actualMin: 20, completed: true }],
      activeFocusSession: { id: "active-old", taskId: "task", mode: "pomodoro", startedAt: now.toISOString(), plannedMin: 25 },
      settings: { ...createDefaultState(now).settings, defaultFocusMode: "pomodoro", focusBreakBufferMin: 10 },
      integrationMetadata: { keep: true },
    };
    const first = migrateState(legacyV2, now);
    const second = migrateState(first, now);
    expect(first.savedPlaces).toEqual([]);
    expect(first.recentPlaces).toEqual([]);
    expect(first.schemaVersion).toBe(3);
    expect(first).not.toHaveProperty("focusSessions");
    expect(first).not.toHaveProperty("activeFocusSession");
    expect(first.settings).not.toHaveProperty("defaultFocusMode");
    expect(first.settings).not.toHaveProperty("focusBreakBufferMin");
    expect((first as unknown as Record<string, unknown>).integrationMetadata).toEqual({ keep: true });
    expect(second).toEqual(first);
  });

  it("imports legacy v2 backups while preserving non-Focus user data", () => {
    const now = new Date("2026-07-23T00:00:00.000Z");
    const current = createDefaultState(now);
    const legacyV2 = {
      ...current,
      schemaVersion: 2,
      tasksByDay: {
        "2026-07-23": [{
          id: "legacy-task",
          title: "งานจากไฟล์สำรอง",
          place: "",
          priority: "normal",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }],
      },
      focusSessions: [{ id: "focus-old", mode: "pomodoro", startedAt: now.toISOString(), plannedMin: 25 }],
      activeFocusSession: { id: "active-old", mode: "pomodoro", startedAt: now.toISOString(), plannedMin: 25 },
      settings: { ...current.settings, defaultFocusMode: "long", focusBreakBufferMin: 15 },
      integrationMetadata: { provider: "legacy-client" },
    };

    for (const mode of ["replace", "merge"] as const) {
      const imported = importState(JSON.stringify(legacyV2), current, mode);
      expect(imported.tasksByDay["2026-07-23"][0].title).toBe("งานจากไฟล์สำรอง");
      expect(imported.schemaVersion).toBe(3);
      expect(imported).not.toHaveProperty("focusSessions");
      expect(imported).not.toHaveProperty("activeFocusSession");
      expect(imported.settings).not.toHaveProperty("defaultFocusMode");
      expect(imported.settings).not.toHaveProperty("focusBreakBufferMin");
    }
  });

  it("does not re-emit injected legacy Focus fields when saving or exporting", () => {
    const storage = new MemoryStorage();
    const current = createDefaultState(new Date("2026-07-23T00:00:00.000Z"));
    const withLegacyFocus = {
      ...current,
      focusSessions: [{ id: "focus-old" }],
      activeFocusSession: { id: "active-old" },
      settings: { ...current.settings, defaultFocusMode: "pomodoro", focusBreakBufferMin: 10 },
    };

    const saved = saveState(storage, withLegacyFocus);
    const persisted = JSON.parse(storage.getItem(STATE_KEY) ?? "{}") as Record<string, unknown>;
    const exported = JSON.parse(exportState(withLegacyFocus)) as Record<string, unknown>;

    for (const value of [saved, persisted, exported]) {
      expect(value).not.toHaveProperty("focusSessions");
      expect(value).not.toHaveProperty("activeFocusSession");
      expect(value.settings).not.toHaveProperty("defaultFocusMode");
      expect(value.settings).not.toHaveProperty("focusBreakBufferMin");
    }
  });

  it("deleting a saved place does not change task location snapshots", () => {
    const state = createDefaultState(new Date("2026-07-23T00:00:00.000Z"));
    const task = createTask({ title: "กลับบ้าน", place: "บ้าน", lat: 13.7, lng: 100.5, locationSource: "saved" }, 0);
    const withPlace = {
      ...state,
      tasksByDay: addTaskToDate(state.tasksByDay, "2026-07-23", task),
      savedPlaces: [{ id: "home", label: "บ้าน", placeName: "คอนโด", latitude: 13.7, longitude: 100.5, category: "home" as const, createdAt: state.updatedAt, updatedAt: state.updatedAt }],
    };
    const afterDelete = { ...withPlace, savedPlaces: withPlace.savedPlaces.filter((place) => place.id !== "home") };
    expect(afterDelete.tasksByDay["2026-07-23"][0]).toMatchObject({ place: "บ้าน", lat: 13.7, lng: 100.5 });
  });

  it("merges imports by task id", () => {
    const current = createDefaultState(new Date("2026-07-19T00:00:00.000Z"));
    const incoming = { ...current, tasksByDay: { "2026-07-19": [{ id: "x", title: "ใหม่", place: "", priority: "normal", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }] } };
    expect(importState(JSON.stringify(incoming), current, "merge").tasksByDay["2026-07-19"]).toHaveLength(1);
  });
});
