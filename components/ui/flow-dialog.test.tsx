import { act, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowDialog } from "@/components/ui/flow-dialog";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let nextFrame = 1;
let frames = new Map<number, FrameRequestCallback>();

function flushAnimationFrames() {
  const pending = [...frames.values()];
  frames.clear();
  pending.forEach((callback) => callback(0));
}

function ConditionalAddDialog() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!open) {
    return <button ref={triggerRef} onClick={() => setOpen(true)}>เพิ่มงาน +</button>;
  }

  return (
    <FlowDialog title="งานใหม่" onClose={() => setOpen(false)} returnFocusRef={triggerRef}>
      <button type="button" onClick={() => setOpen(false)}>ยกเลิก</button>
    </FlowDialog>
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  frames = new Map();
  nextFrame = 1;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    const id = nextFrame++;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  frames.clear();
  vi.unstubAllGlobals();
});

describe("FlowDialog focus restoration", () => {
  it("returns focus to a trigger that is remounted after the dialog closes", () => {
    act(() => root?.render(<ConditionalAddDialog />));
    const originalTrigger = container?.querySelector("button") as HTMLButtonElement;
    originalTrigger.focus();

    act(() => originalTrigger.click());
    expect(originalTrigger.isConnected).toBe(false);
    act(flushAnimationFrames);

    const cancel = [...(container?.querySelectorAll("button") ?? [])]
      .find((button) => button.textContent === "ยกเลิก") as HTMLButtonElement;
    act(() => cancel.click());

    const remountedTrigger = container?.querySelector("button") as HTMLButtonElement;
    expect(remountedTrigger).not.toBe(originalTrigger);
    expect(document.activeElement).not.toBe(remountedTrigger);
    act(flushAnimationFrames);
    expect(document.activeElement).toBe(remountedTrigger);
  });

  it("returns focus after the dialog close transition", async () => {
    act(() => root?.render(<ConditionalAddDialog />));
    const originalTrigger = container?.querySelector("button") as HTMLButtonElement;
    originalTrigger.focus();
    act(() => originalTrigger.click());
    act(flushAnimationFrames);

    const closeButton = container?.querySelector<HTMLButtonElement>('button[aria-label="ปิดหน้าต่าง"]');
    expect(closeButton).toBeTruthy();
    act(() => closeButton?.click());
    expect(container?.querySelector('[role="dialog"]')).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 190));
    });
    const remountedTrigger = container?.querySelector("button") as HTMLButtonElement;
    act(flushAnimationFrames);
    expect(document.activeElement).toBe(remountedTrigger);
  });
});
