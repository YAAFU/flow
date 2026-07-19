import { describe, expect, it } from "vitest";
import { mergeOccurrences, occurrencesForRange } from "@/lib/recurrence";
import type { RecurrenceRule, Task } from "@/lib/types";

const task: Task = { id: "t", title: "เรียน", place: "", priority: "normal" };
const rule: RecurrenceRule = { id: "r", taskId: "t", frequency: "weekly", interval: 1, weekdays: [1, 3], startDate: "2026-07-19", excludedDates: [], createdAt: "2026-07-19T00:00:00.000Z", updatedAt: "2026-07-19T00:00:00.000Z" };

describe("recurrence", () => {
  it("generates only dates in the requested range", () => {
    expect(occurrencesForRange(task, rule, "2026-07-20", "2026-07-26").map((item) => item.occurrenceDate)).toEqual(["2026-07-20", "2026-07-22"]);
  });
  it("does not duplicate a generated occurrence", () => {
    const generated = occurrencesForRange(task, rule, "2026-07-20", "2026-07-20");
    expect(mergeOccurrences(generated, generated)).toHaveLength(1);
  });
});
