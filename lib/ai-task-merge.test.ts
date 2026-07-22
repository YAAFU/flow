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

  it("rejects a schedule that moves a locked task", () => {
    const locked: Task = {
      id: "locked", title: "ประชุมล็อกเวลา", place: "ออฟฟิศ", fixedTime: "13:00",
      durationMin: 60, lockTime: true, priority: "high", order: 0,
    };
    expect(() => mergeScheduleIntoTasks({
      existing: [locked], drafts: [], categories: [], now: "2026-07-21T12:00:00.000Z", createId: () => "generated",
      schedule: [{ taskId: "locked", title: locked.title, placeLabel: locked.place, start: "13:30", end: "14:30", travelFromPrevMin: 0 }],
    })).toThrow("แผนพยายามเลื่อนงานที่ล็อกเวลาไว้");
  });

  it("rejects a duration change but accepts the exact locked start and duration", () => {
    const locked: Task = {
      id: "locked", title: "ประชุมล็อกเวลา", place: "ออฟฟิศ", fixedTime: "13:00",
      durationMin: 60, lockTime: true, priority: "high", order: 0,
    };
    const input = {
      existing: [locked], drafts: [], categories: [], now: "2026-07-21T12:00:00.000Z", createId: () => "generated",
    };
    expect(() => mergeScheduleIntoTasks({
      ...input,
      schedule: [{ taskId: "locked", title: locked.title, placeLabel: locked.place, start: "13:00", end: "14:30", travelFromPrevMin: 0 }],
    })).toThrow("แผนพยายามเปลี่ยนระยะเวลาของงานที่ล็อกไว้");

    const result = mergeScheduleIntoTasks({
      ...input,
      schedule: [{ taskId: "locked", title: locked.title, placeLabel: locked.place, start: "13:00", end: "14:00", travelFromPrevMin: 0 }],
    });
    expect(result.tasks[0]).toMatchObject({ fixedTime: "13:00", durationMin: 60, lockTime: true });
  });

  it("keeps structured draft coordinates and clears stale coordinates when a place label changes", () => {
    const locatedDraft: PersistablePlannerDraft = {
      ...draft,
      place: "สยาม",
      lat: 13.746,
      lng: 100.534,
      locationSource: "search",
    };
    const created = mergeScheduleIntoTasks({
      existing: [], drafts: [locatedDraft], categories: [], now: "2026-07-21T12:00:00.000Z", createId: () => "generated",
      schedule: [{ taskId: plannerDraftTaskId("new"), title: "งานใหม่", placeLabel: "สยาม", start: "09:00", end: "09:30", travelFromPrevMin: 0 }],
    });
    expect(created.tasks[0]).toMatchObject({ place: "สยาม", lat: 13.746, lng: 100.534, locationSource: "search" });

    const moved = mergeScheduleIntoTasks({
      existing: [created.tasks[0]], drafts: [], categories: [], now: "2026-07-21T13:00:00.000Z", createId: () => "generated",
      schedule: [{ taskId: created.tasks[0].id, title: "งานใหม่", placeLabel: "อโศก", start: "10:00", end: "10:30", travelFromPrevMin: 0 }],
    });
    expect(moved.tasks[0]).toMatchObject({ place: "อโศก" });
    expect(moved.tasks[0].lat).toBeUndefined();
    expect(moved.tasks[0].lng).toBeUndefined();
    expect(moved.tasks[0].locationSource).toBeUndefined();
  });
});
