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

  it("sends every selected-day task to the map without inventing a time", () => {
    expect(source).toContain('import type { MapTaskItem } from "@/components/FlowMap"');
    expect(source).toContain("const mapItems=useMemo<MapTaskItem[]>(()=>tasks.map(task=>");
    expect(source).toContain("placeLabel:task.place.trim()||undefined");
    expect(source).toContain("lat:task.lat");
    expect(source).toContain("lng:task.lng");
    expect(source).toContain("scheduled=Boolean(task.fixedTime&&!task.allDay)");
    expect(source).toContain("start=scheduled?task.fixedTime:undefined");
    expect(source).toContain("end:start&&task.durationMin?endTime(start,task.durationMin):undefined");
    expect(source).not.toContain('task.fixedTime??"00:00"');
    expect(source).not.toContain("tasks.filter(task=>task.fixedTime).map");
  });

  it("keeps the map mounted offline and exposes task recovery actions", () => {
    expect(source).toMatch(/dayView==="map"&&<FlowMap items=\{mapItems\}/);
    expect(source).toContain("online={online}");
    expect(source).toContain("onEditTask={openTaskEditor}");
    expect(source).toContain('onAddTask={()=>setTaskFlow({mode:"addingTask",date:selectedDate})}');
  });

  it("removes the product Focus mode while keeping old focus URLs safe", () => {
    expect(source).not.toContain('type DayView = "list" | "timeline" | "focus"');
    expect(source).not.toContain('dayView==="focus"');
    expect(source).not.toContain("FocusPanel");
    expect(source).not.toContain('["focus","โฟกัส"');
    expect(source).toContain('requestedView==="focus"');
    expect(source).toMatch(/requestedView==="focus"[\s\S]{0,120}setDayView\("timeline"\)/);
  });

  it("offers three balanced day views and routes scheduled primary actions to Timeline", () => {
    expect(source).toContain("grid grid-cols-3");
    expect(source).not.toContain('tasks.length>0&&<div ref={dayViewAnchorRef}');
    expect(source).toContain('["list","รายการ",LayoutList]');
    expect(source).toContain('["timeline","เวลา",Clock3]');
    expect(source).toContain('["map","แผนที่",MapIcon]');
    expect(source).toContain("onOpenTimeline={openTimeline}");
  });
});
