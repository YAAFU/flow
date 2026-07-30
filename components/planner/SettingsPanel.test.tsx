import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/planner/SettingsPanel";
import { createDefaultState } from "@/lib/storage";
import { createTask } from "@/lib/task-factory";
import { TaskSchema } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function findButton(label: string): HTMLButtonElement | undefined {
  return [...(container?.querySelectorAll("button") ?? [])].find((item) =>
    item.textContent?.replace(/\s+/g, " ").trim().includes(label),
  ) as HTMLButtonElement | undefined;
}

async function click(target: HTMLButtonElement | undefined) {
  expect(target).toBeTruthy();
  await act(async () => {
    target?.click();
    await Promise.resolve();
  });
}

function renderSettings(overrides: Partial<ComponentProps<typeof SettingsPanel>> = {}) {
  const state = overrides.state ?? createDefaultState(new Date("2026-07-23T01:00:00.000Z"));
  const props: ComponentProps<typeof SettingsPanel> = {
    state,
    onReplace: vi.fn(),
    onSettings: vi.fn(),
    onAddCategory: vi.fn(),
    onDeleteCategory: vi.fn(),
    ...overrides,
  };
  act(() => root?.render(<SettingsPanel {...props} />));
  return props;
}

beforeEach(() => {
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
});

describe("SettingsPanel help actions", () => {
  it("offers every Flow help entry and delegates each action to its callback", async () => {
    const callbacks = {
      onStartCoreTour: vi.fn(),
      onStartFullTour: vi.fn(),
      onTrySampleDay: vi.fn(),
      onShowCalendarComparison: vi.fn(),
      onRestartGuide: vi.fn(),
      onRestartQuickStart: vi.fn(),
    };
    renderSettings(callbacks);

    expect(container?.textContent).toContain("วิธีใช้ Flow");
    await click(findButton("เริ่ม Quick Start ใหม่"));
    await click(findButton("เปิด Core Tour"));
    await click(findButton("เปิด Full Tour"));
    await click(findButton("ลองสร้างวันตัวอย่าง"));
    await click(findButton("Flow ต่างจากปฏิทินอย่างไร"));
    await click(findButton("เริ่ม Product Guide ใหม่"));

    Object.values(callbacks).forEach((callback) => expect(callback).toHaveBeenCalledTimes(1));
  });

  it("requires confirmation and delegates a guidance-only reset without touching user state", async () => {
    const state = createDefaultState(new Date("2026-07-23T01:00:00.000Z"));
    state.tasksByDay["2026-07-23"] = [TaskSchema.parse(createTask({ title: "งานที่ต้องเก็บไว้" }, 0, new Date("2026-07-23T01:00:00.000Z")))];
    const before = JSON.stringify(state);
    const onResetGuidance = vi.fn(async () => undefined);
    const onReplace = vi.fn();
    renderSettings({ state, onResetGuidance, onReplace });

    await click(findButton("รีเซ็ตสถานะคำแนะนำ"));
    expect(onResetGuidance).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("ไม่ลบงาน หมวดหมู่ หรือการตั้งค่าอื่น");
    expect(container?.textContent).not.toContain("ค่าเริ่มต้น Focus");

    await click(findButton("ยกเลิก"));
    expect(onResetGuidance).not.toHaveBeenCalled();
    await click(findButton("รีเซ็ตสถานะคำแนะนำ"));
    await click(findButton("ยืนยันรีเซ็ต"));

    expect(onResetGuidance).toHaveBeenCalledTimes(1);
    expect(onResetGuidance).toHaveBeenCalledWith();
    expect(onReplace).not.toHaveBeenCalled();
    expect(JSON.stringify(state)).toBe(before);
  });

  it("keeps legacy call sites safe by disabling help controls whose callbacks are absent", () => {
    renderSettings();

    [
      "เริ่ม Quick Start ใหม่",
      "เปิด Core Tour",
      "เปิด Full Tour",
      "ลองสร้างวันตัวอย่าง",
      "Flow ต่างจากปฏิทินอย่างไร",
      "เริ่ม Product Guide ใหม่",
      "รีเซ็ตสถานะคำแนะนำ",
    ].forEach((label) => expect(findButton(label)?.disabled).toBe(true));
  });
});
