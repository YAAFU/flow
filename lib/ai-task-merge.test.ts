import { describe, expect, it } from "vitest";
import { mergeScheduleIntoTasks, plannerDraftTaskId, type PersistablePlannerDraft } from "@/lib/ai-task-merge";
import type { Task } from "@/lib/types";

const existing: Task[] = [
  { id: "one", title: "งานเดิม", place: "บ้าน", priority: "normal", order: 0 },
  { id: "untouched", title: "งานที่ไม่อยู่ในแผน", place: "", priority: "flex", order: 1 },
];
const draft: PersistablePlannerDraft = { draftId: "new", title: "งานใหม่", place: "", durationMin: 30, allDay: false, priority: "high", reminderOffsets: [], repeat: "none", needsReview: false, note: "" };

describe("AI plan task merge", () => {
  it("updates scheduled tasks, creates selected drafts, and preserves omitted existing tasks", () => {
    const result = mergeScheduleIntoTasks({
      existing,
      drafts: [draft],
      schedule: [
        { taskId: "one", title: "งานเดิมแก้ชื่อ", placeLabel: "บ้าน", start: "09:00", end: "10:00", travelFromPrevMin: 0 },
        { taskId: plannerDraftTaskId("new"), title: "งานใหม่", placeLabel: "", start: "10:30", end: "11:00", travelFromPrevMin: 0 },
      ],
      categories: [], now: "2026-07-21T12:00:00.000Z", createId: () => "generated",
    });
    expect(result.tasks.map((task) => task.id)).toEqual(["one", plannerDraftTaskId("new"), "untouched"]);
    expect(result.tasks[0]).toMatchObject({ title: "งานเดิมแก้ชื่อ", fixedTime: "09:00", durationMin: 60 });
    expect(result.tasks[2].title).toBe("งานที่ไม่อยู่ในแผน");
    expect(result.includedDrafts).toEqual([draft]);
  });

  it("rejects duplicate schedule entries instead of creating duplicate tasks", () => {
    expect(() => mergeScheduleIntoTasks({
      existing, drafts: [], categories: [], now: "2026-07-21T12:00:00.000Z", createId: () => "generated",
      schedule: [
        { taskId: "one", title: "งานเดิม", placeLabel: "", start: "09:00", end: "10:00", travelFromPrevMin: 0 },
        { taskId: "one", title: "งานเดิม", placeLabel: "", start: "10:00", end: "11:00", travelFromPrevMin: 0 },
      ],
    })).toThrow("แผนมีงานซ้ำ");
  });
});
