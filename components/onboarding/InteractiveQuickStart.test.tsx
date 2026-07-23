import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveQuickStart, type InteractiveQuickStartProps } from "@/components/onboarding/InteractiveQuickStart";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const callbacks = {
  onAddTask: vi.fn(),
  onScheduleTask: vi.fn(),
  onSkip: vi.fn(),
  onSuccessShown: vi.fn(),
  onViewTimeline: vi.fn(),
  onStartFocus: vi.fn(),
};

function target(stage: "add-task" | "schedule-task") {
  const button = document.createElement("button");
  button.dataset.quickStart = stage;
  button.textContent = stage;
  button.getBoundingClientRect = () => ({
    x: 20, y: 120, top: 120, left: 20, right: 320, bottom: 170,
    width: 300, height: 50, toJSON: () => ({}),
  });
  document.body.append(button);
  return button;
}

async function render(props: Partial<InteractiveQuickStartProps> = {}) {
  const full: InteractiveQuickStartProps = {
    state: { status: "started", stage: "add_task", startedAt: new Date().toISOString() },
    active: true,
    showSuccess: false,
    ...callbacks,
    ...props,
  };
  await act(async () => {
    root?.render(<InteractiveQuickStart {...full} />);
    await Promise.resolve();
  });
  await vi.waitFor(() => expect(container?.querySelector('[role="dialog"]')).toBeTruthy());
}

function button(label: string) {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find((item) =>
    item.textContent?.includes(label),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  Object.values(callbacks).forEach((callback) => callback.mockReset());
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("InteractiveQuickStart", () => {
  it("points at the real add target and has one primary action instead of a Next button", async () => {
    const addTarget = target("add-task");
    await render();
    expect(container?.textContent).toContain("เพิ่มงานแรกของคุณ");
    expect(button("เพิ่มงานแรก")).toBeTruthy();
    expect(container?.textContent).not.toContain("ถัดไป");
    expect(addTarget.hasAttribute("inert")).toBe(false);
    expect(addTarget.getAttribute("aria-hidden")).toBeNull();
    expect(addTarget.getAttribute("tabindex")).toBeNull();

    await act(async () => button("เพิ่มงานแรก")?.click());
    expect(callbacks.onAddTask).toHaveBeenCalledOnce();
    expect(callbacks.onScheduleTask).not.toHaveBeenCalled();
  });

  it("dims only around the spotlight so the real target stays crisp and clickable", async () => {
    const onTargetClick = vi.fn();
    const addTarget = target("add-task");
    addTarget.addEventListener("click", onTargetClick);
    await render();

    const overlays = container?.querySelectorAll<HTMLElement>("[data-quick-start-overlay]");
    const highlight = container?.querySelector<HTMLElement>("[data-quick-start-highlight]");
    expect(overlays).toHaveLength(4);
    overlays?.forEach((overlay) => {
      expect(overlay.className).not.toContain("backdrop-blur");
      expect(overlay.style.filter).toBe("");
      expect(overlay.style.opacity).toBe("");
    });
    expect(highlight?.className).toContain("pointer-events-none");
    expect(highlight?.className).toContain("z-[69]");
    expect(addTarget.style.filter).toBe("");
    expect(addTarget.style.opacity).toBe("");

    await act(async () => addTarget.click());
    expect(onTargetClick).toHaveBeenCalledOnce();
  });

  it("opens the existing planner action but does not complete merely by opening it", async () => {
    target("schedule-task");
    await render({
      state: { status: "started", stage: "schedule_task", taskId: "task-1" },
    });
    expect(container?.textContent).toContain("ให้งานมีที่อยู่ในวัน");
    await act(async () => button("จัดเวลาให้งานนี้")?.click());
    expect(callbacks.onScheduleTask).toHaveBeenCalledOnce();
    expect(callbacks.onSuccessShown).not.toHaveBeenCalled();
  });

  it("hides while another overlay is open and resumes at the same stage", async () => {
    target("add-task");
    await act(async () => {
      root?.render(<InteractiveQuickStart
        state={{ status: "started", stage: "add_task" }}
        active
        blocked
        showSuccess={false}
        {...callbacks}
      />);
      await Promise.resolve();
    });
    expect(container?.querySelector('[role="dialog"]')).toBeNull();
    await render();
    expect(container?.textContent).toContain("เพิ่มงานแรกของคุณ");
  });

  it("shows success only when requested and delegates Timeline and Focus", async () => {
    await render({
      state: { status: "started", stage: "completed", taskId: "task-1" },
      showSuccess: true,
    });
    expect(container?.textContent).toContain("แผนวันแรกพร้อมแล้ว");
    expect(callbacks.onSuccessShown).toHaveBeenCalledOnce();
    await act(async () => button("ดู Timeline")?.click());
    await act(async () => button("เริ่มโฟกัส")?.click());
    expect(callbacks.onViewTimeline).toHaveBeenCalledOnce();
    expect(callbacks.onStartFocus).toHaveBeenCalledOnce();
  });

  it("skips with Escape and never invokes a primary action", async () => {
    target("add-task");
    await render();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    expect(callbacks.onSkip).toHaveBeenCalledOnce();
    expect(callbacks.onAddTask).not.toHaveBeenCalled();
  });
});
