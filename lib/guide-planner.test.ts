import { describe, expect, it } from "vitest";
import { createDefaultState } from "@/lib/storage";
import { createGuideDrafts, toPlannerDrafts } from "@/lib/guide-templates";
import {
  applyGuidePlan,
  buildLocalGuidePlan,
  guideDraftsToTasks,
  type GuidePlanSettings,
} from "@/lib/guide-planner";

const settings: GuidePlanSettings = {
  date: "2026-07-23",
  dayStart: "08:00",
  dayEnd: "22:00",
  energy: "medium",
  breakMin: 30,
};

describe("guide planner", () => {
  it("keeps template drafts out of FlowState until apply", () => {
    const state = createDefaultState(new Date("2026-07-23T01:00:00.000Z"));
    const before = structuredClone(state);
    const drafts = toPlannerDrafts(createGuideDrafts("school"));
    const tasks = guideDraftsToTasks(drafts, state);
    const plan = buildLocalGuidePlan(tasks, settings);

    expect(state).toEqual(before);
    expect(state.tasksByDay[settings.date]).toBeUndefined();
    expect(plan.mode).toBe("local");
  });

  it("creates real scheduled tasks only after the selected plan is confirmed", () => {
    const state = createDefaultState(new Date("2026-07-23T01:00:00.000Z"));
    const drafts = toPlannerDrafts(createGuideDrafts("project"));
    const tasks = guideDraftsToTasks(drafts, state);
    const plan = buildLocalGuidePlan(tasks, settings);
    const next = applyGuidePlan(state, {
      settings,
      drafts,
      plan,
      variant: "A",
      now: new Date("2026-07-23T02:00:00.000Z"),
      createId: (() => {
        let sequence = 0;
        return () => `guide-added-${++sequence}`;
      })(),
    });

    expect(next.selectedDate).toBe(settings.date);
    expect(next.tasksByDay[settings.date]).toHaveLength(drafts.length);
    expect(next.tasksByDay[settings.date].every((task) => task.fixedTime)).toBe(true);
    expect(next.dayMetaByDay[settings.date]?.energy).toBe("medium");
  });
});
