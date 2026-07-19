import { describe, expect, it } from "vitest";
import { carryTask } from "@/lib/carryover";
import type { Task } from "@/lib/types";

describe("carry over", () => {
  it("unschedules a past time and records movement", () => {
    const task: Task = { id: "a", title: "ค้าง", place: "", priority: "normal", fixedTime: "08:00", movedCount: 0 };
    const moved = carryTask(task, "2026-07-18", "2026-07-19", "move", new Date("2026-07-19T10:00:00"));
    expect(moved).toMatchObject({ fixedTime: undefined, movedCount: 1, originalDate: "2026-07-18" });
  });
});
