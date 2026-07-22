import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DayTimeline } from "@/components/planner/DayTimeline";
import type { Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const task: Task = {
  id: "awaiting-duration",
  title: "งานรอประเมิน",
  place: "",
  priority: "normal",
  fixedTime: "10:00",
};

function renderTimeline(onChange: (task: Task) => void) {
  act(() => {
    root?.render(
      <DayTimeline
        date="2026-07-21"
        tasks={[task]}
        categories={[]}
        startHour={8}
        endHour={22}
        onChange={onChange}
        onDelete={() => undefined}
        onToggle={() => undefined}
      />,
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
});

describe("DayTimeline duration preservation", () => {
  it("moves an unsized task without inventing a duration", () => {
    const onChange = vi.fn();
    renderTimeline(onChange);
    const moveButton = container?.querySelector<HTMLButtonElement>('button[aria-label*="งานรอประเมิน เวลา"]');

    act(() => moveButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ fixedTime: "10:15", durationMin: undefined });
  });

  it("sets a duration only when the user explicitly resizes", () => {
    const onChange = vi.fn();
    renderTimeline(onChange);
    const moveButton = container?.querySelector<HTMLButtonElement>('button[aria-label*="งานรอประเมิน เวลา"]');

    act(() => moveButton?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true })));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toMatchObject({ fixedTime: "10:00", durationMin: 75 });
  });
});
