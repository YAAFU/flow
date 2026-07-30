import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodayPulse } from "@/components/planner/TodayPulse";
import { TaskSchema, type Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function task(overrides: Partial<Task> = {}): Task {
  return TaskSchema.parse({
    id: "task-1",
    title: "ทำรายงาน",
    place: "",
    priority: "normal",
    fixedTime: "11:00",
    durationMin: 60,
    ...overrides,
  });
}

function render(tasks: Task[], onOpenTimeline = vi.fn()) {
  act(() => {
    root?.render(
      <TodayPulse
        date="2026-07-24"
        tasks={tasks}
        startHour={8}
        endHour={22}
        onOpenTimeline={onOpenTimeline}
      />,
    );
  });
  return onOpenTimeline;
}

function buttonsContaining(label: string) {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .filter((button) => button.textContent?.includes(label));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-24T03:00:00.000Z"));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.useRealTimers();
});

describe("TodayPulse primary action", () => {
  it("opens Timeline from one clear action when a next task remains", () => {
    const onOpenTimeline = render([task()]);
    const timelineActions = buttonsContaining("Timeline");

    expect(timelineActions).toHaveLength(1);
    expect(timelineActions[0].textContent).toContain("ดูงานถัดไปบน Timeline");
    act(() => timelineActions[0].click());
    expect(onOpenTimeline).toHaveBeenCalledOnce();
    expect(container?.textContent).not.toContain("โฟกัส");
  });

  it("offers today's Timeline after every scheduled task is complete", () => {
    render([task({ done: true })]);

    const timelineActions = buttonsContaining("Timeline");
    expect(timelineActions).toHaveLength(1);
    expect(timelineActions[0].textContent).toContain("ดู Timeline ของวันนี้");
  });
});
