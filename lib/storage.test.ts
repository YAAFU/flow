import { describe, expect, it } from "vitest";
import { BACKUP_KEY, LEGACY_TASKS_KEY, STATE_KEY, createDefaultState, importState, loadState, saveState, type StorageLike } from "@/lib/storage";
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
      reminderLog: [{ id: "notice", taskId: "task", occurrenceDate: "2026-07-20", offsetMin: 10, notifiedAt: timestamp }],
      selectedDate: "2026-07-20",
      updatedAt: timestamp,
    }));
    const state = loadState(storage);
    expect(state.recurrenceRules).toHaveLength(1);
    expect(state.dayMetaByDay["2026-07-20"].energy).toBe("high");
    expect(state.focusSessions).toHaveLength(1);
    expect(state.reminderLog).toHaveLength(1);
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

  it("merges imports by task id", () => {
    const current = createDefaultState(new Date("2026-07-19T00:00:00.000Z"));
    const incoming = { ...current, tasksByDay: { "2026-07-19": [{ id: "x", title: "ใหม่", place: "", priority: "normal", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }] } };
    expect(importState(JSON.stringify(incoming), current, "merge").tasksByDay["2026-07-19"]).toHaveLength(1);
  });
});
