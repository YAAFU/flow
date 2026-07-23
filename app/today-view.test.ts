import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Today view composition", () => {
  const source = readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");

  it("does not render or retain the old category-filter state", () => {
    expect(source).not.toContain("categoryFilter");
    expect(source).not.toContain("shownTasks");
    expect(source).not.toContain("ยังไม่มีงานในหมวดนี้");
  });

  it("passes the full task collection to both list and timeline views", () => {
    expect(source).toMatch(/<DayTimeline[^>]+tasks=\{tasks\}/);
    expect(source).toMatch(/<TaskListView tasks=\{tasks\}/);
  });
});
