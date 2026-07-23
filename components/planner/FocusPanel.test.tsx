import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FocusPanel } from "@/components/planner/FocusPanel";
import { localDateKey } from "@/lib/time";
import type { ActiveFocusSession, Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const readyTask: Task = {
  id: "ready",
  title: "ทำรายงาน",
  place: "",
  priority: "normal",
  durationMin: 60,
  order: 0,
  done: false,
};

function button(label: string) {
  return [...(container?.querySelectorAll("button") ?? [])].find((element) => element.textContent?.includes(label)) as HTMLButtonElement | undefined;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("FocusPanel timeline integration", () => {
  it("auto-selects a ready task and starts with one primary action", () => {
    const onActiveChange = vi.fn();
    act(() => root?.render(<FocusPanel
      date={localDateKey()}
      tasks={[readyTask]}
      sessions={[]}
      onActiveChange={onActiveChange}
      onComplete={vi.fn()}
      onTaskComplete={vi.fn()}
      onReschedule={vi.fn()}
    />));
    expect(container?.textContent).toContain("ทำรายงาน");
    expect(button("เริ่มโฟกัส")).toBeTruthy();
    expect(container?.querySelector("select")).toBeNull();

    act(() => {
      button("เริ่มโฟกัส")?.click();
      button("เริ่มโฟกัส")?.click();
    });
    expect(onActiveChange).toHaveBeenCalledTimes(1);
    expect(onActiveChange).toHaveBeenCalledWith(expect.objectContaining({ taskId: "ready", plannedMin: 25 }));
  });

  it("finishes through an explicit outcome and marks the linked task complete", () => {
    const active: ActiveFocusSession = {
      id: "focus",
      taskId: "ready",
      date: localDateKey(),
      mode: "pomodoro",
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      plannedMin: 25,
      pausedMs: 0,
    };
    const onComplete = vi.fn();
    const onTaskComplete = vi.fn();
    act(() => root?.render(<FocusPanel
      date={localDateKey()}
      tasks={[readyTask]}
      sessions={[]}
      active={active}
      onActiveChange={vi.fn()}
      onComplete={onComplete}
      onTaskComplete={onTaskComplete}
      onReschedule={vi.fn()}
    />));
    act(() => button("จบก่อนเวลา")?.click());
    act(() => button("งานเสร็จแล้ว")?.click());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ taskId: "ready", outcome: "completed" }), "completed");
    expect(onTaskComplete).toHaveBeenCalledWith("ready");
  });

  it("shows a preview before requesting reschedule", () => {
    const active: ActiveFocusSession = {
      id: "focus",
      taskId: "ready",
      date: localDateKey(),
      mode: "pomodoro",
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      plannedMin: 25,
      pausedMs: 0,
    };
    const onReschedule = vi.fn();
    act(() => root?.render(<FocusPanel
      date={localDateKey()}
      tasks={[readyTask]}
      sessions={[]}
      active={active}
      onActiveChange={vi.fn()}
      onComplete={vi.fn()}
      onTaskComplete={vi.fn()}
      onReschedule={onReschedule}
    />));
    act(() => button("จบก่อนเวลา")?.click());
    act(() => button("จัดเวลาใหม่")?.click());
    expect(container?.textContent).toContain("ตรวจสอบก่อนจัดเวลาใหม่");
    expect(onReschedule).not.toHaveBeenCalled();
    act(() => button("ยืนยัน")?.click());
    expect(onReschedule).toHaveBeenCalledWith("ready", expect.any(Number));
  });

  it("does not offer rescheduling for a locked task", () => {
    const active: ActiveFocusSession = {
      id: "focus-locked",
      taskId: "ready",
      date: localDateKey(),
      mode: "pomodoro",
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      plannedMin: 25,
      pausedMs: 0,
    };
    act(() => root?.render(<FocusPanel
      date={localDateKey()}
      tasks={[{ ...readyTask, lockTime: true }]}
      sessions={[]}
      active={active}
      onActiveChange={vi.fn()}
      onComplete={vi.fn()}
      onTaskComplete={vi.fn()}
      onReschedule={vi.fn()}
    />));
    act(() => button("จบก่อนเวลา")?.click());
    expect(button("จัดเวลาใหม่")?.disabled).toBe(true);
    expect(container?.textContent).toContain("งานนี้ล็อกเวลาไว้ Flow จะไม่ย้ายเวลา");
  });

  it("keeps a focus session usable when its task was deleted", () => {
    const active: ActiveFocusSession = {
      id: "focus-orphan",
      taskId: "deleted",
      date: localDateKey(),
      mode: "pomodoro",
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      plannedMin: 25,
      pausedMs: 0,
    };
    const onComplete = vi.fn();
    act(() => root?.render(<FocusPanel
      date={localDateKey()}
      tasks={[readyTask]}
      sessions={[]}
      active={active}
      onActiveChange={vi.fn()}
      onComplete={onComplete}
      onTaskComplete={vi.fn()}
      onReschedule={vi.fn()}
    />));
    expect(container?.textContent).toContain("งานนี้ไม่พร้อมใช้งานแล้ว");
    act(() => button("จบก่อนเวลา")?.click());
    act(() => button("จบและเก็บ Session นี้")?.click());
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ taskId: "deleted", outcome: "abandoned" }), "abandoned");
  });
});
