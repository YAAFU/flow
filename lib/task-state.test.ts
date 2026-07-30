import { describe, expect, it } from "vitest";
import { addTaskToDate, removeTaskFromDate, updateTaskInDate } from "@/lib/task-state";
import type { FlowState, Task } from "@/lib/types";

const createdAt = "2026-07-20T01:00:00.000Z";
const task: Task = { id: "task-a", title: "ประชุมทีม", place: "", priority: "normal", order: 3, done: false, createdAt, updatedAt: createdAt };

describe("task state helpers", () => {
  it("adds a task only to the selected date and ignores a duplicate id", () => {
    const before: FlowState["tasksByDay"] = { "2026-07-20": [] };
    const added = addTaskToDate(before, "2026-07-21", task);
    expect(added["2026-07-20"]).toEqual([]);
    expect(added["2026-07-21"]).toHaveLength(1);
    expect(addTaskToDate(added, "2026-07-21", task)["2026-07-21"]).toHaveLength(1);
    expect(before["2026-07-21"]).toBeUndefined();
  });

  it("edits in place while preserving identity and existing metadata", () => {
    const added = addTaskToDate({}, "2026-07-21", task);
    const changed = updateTaskInDate(added, "2026-07-21", { ...task, title: "ประชุมทีมใหม่", fixedTime: "13:00", done: true }, new Date("2026-07-20T02:00:00.000Z"));
    expect(changed["2026-07-21"][0]).toMatchObject({ id: "task-a", createdAt, order: 3, done: true, title: "ประชุมทีมใหม่", fixedTime: "13:00", updatedAt: "2026-07-20T02:00:00.000Z" });
  });

  it("deletes only the requested task from the requested date", () => {
    const sameIdOtherDay = { ...task, title: "อีกวัน" };
    const state = addTaskToDate(addTaskToDate({}, "2026-07-21", task), "2026-07-22", sameIdOtherDay);
    const removed = removeTaskFromDate(state, "2026-07-21", task.id);
    expect(removed["2026-07-21"]).toEqual([]);
    expect(removed["2026-07-22"]).toHaveLength(1);
  });
});
