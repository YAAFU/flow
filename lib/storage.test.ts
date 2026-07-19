import { describe, expect, it } from "vitest";
import { BACKUP_KEY, LEGACY_TASKS_KEY, STATE_KEY, createDefaultState, importState, loadState, type StorageLike } from "@/lib/storage";

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

  it("merges imports by task id", () => {
    const current = createDefaultState(new Date("2026-07-19T00:00:00.000Z"));
    const incoming = { ...current, tasksByDay: { "2026-07-19": [{ id: "x", title: "ใหม่", place: "", priority: "normal", createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" }] } };
    expect(importState(JSON.stringify(incoming), current, "merge").tasksByDay["2026-07-19"]).toHaveLength(1);
  });
});
