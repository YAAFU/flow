import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIPlannerDialog } from "@/components/planner/AIPlannerDialog";
import type { ParsedTasksResponse } from "@/lib/ai-parse";
import type { PlanResult, Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const targetTask: Task = { id: "target-task", title: "ประชุมทีม", place: "ออฟฟิศ", priority: "high", fixedTime: "10:00", durationMin: 60 };

const parsed: ParsedTasksResponse = {
  mode: "local",
  tasks: [{
    title: "เขียนรายงาน",
    place: "บ้าน",
    fixedTime: "13:00",
    durationMin: 90,
    allDay: false,
    priority: "normal",
    reminderOffsets: [],
    repeat: "none",
    needsReview: false,
    note: "",
  }],
};

const plan: PlanResult = {
  mode: "local",
  summary: "จัดงานตามเวลาที่ระบุ",
  tip: "ตรวจเวลาอีกครั้งก่อนบันทึก",
  plans: {
    A: { schedule: [{ taskId: targetTask.id, title: targetTask.title, placeLabel: targetTask.place, start: "10:00", end: "11:00", travelFromPrevMin: 0 }], controlScore: 90, freeTimeMin: 600, riskScore: 0, riskPoints: [] },
    B: { schedule: [{ taskId: targetTask.id, title: targetTask.title, placeLabel: targetTask.place, start: "10:15", end: "11:15", travelFromPrevMin: 0 }], controlScore: 88, freeTimeMin: 600, riskScore: 0, riskPoints: [] },
  },
};

function setControlValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function button(text: string) {
  return [...(container?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes(text)) as HTMLButtonElement | undefined;
}

async function click(element: HTMLButtonElement | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
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

describe("AIPlannerDialog", () => {
  it("keeps parsed tasks as an editable local draft until append is confirmed", async () => {
    const onParse = vi.fn(async () => parsed);
    const onAppendDrafts = vi.fn(async () => undefined);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} preferredMode="ai" onClose={vi.fn()} onParse={onParse} onGeneratePlan={vi.fn()} onAppendDrafts={onAppendDrafts} onApplyPlan={vi.fn()} />);
    });

    const request = container?.querySelector<HTMLTextAreaElement>("#planner-request");
    expect(request).toBeTruthy();
    setControlValue(request!, "เขียนรายงาน 90 นาที");
    await click(button("แปลงข้อความเป็นฉบับร่าง"));

    expect(onParse).toHaveBeenCalledWith(expect.objectContaining({ targetDate: "2026-07-21", dayStart: "08:00", dayEnd: "22:00", breakMinutes: 30 }));
    expect(container?.textContent).toContain("LOCAL MODE");
    expect(container?.querySelector<HTMLInputElement>('input[value="เขียนรายงาน"]')).toBeTruthy();
    expect(onAppendDrafts).not.toHaveBeenCalled();

    await click(button("บันทึกเฉพาะงานใหม่"));
    expect(onAppendDrafts).toHaveBeenCalledWith(expect.objectContaining({ targetDate: "2026-07-21", drafts: [expect.objectContaining({ title: "เขียนรายงาน" })] }));
  });

  it("plans with the source-of-truth tasks for a newly selected target date", async () => {
    const onGeneratePlan = vi.fn(async () => plan);
    const onTargetDateChange = vi.fn();
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} getTasksForDate={(date) => date === "2026-07-23" ? [targetTask] : []} onTargetDateChange={onTargetDateChange} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    const date = container?.querySelector<HTMLInputElement>("#planner-date");
    expect(date).toBeTruthy();
    setControlValue(date!, "2026-07-23");
    expect(onTargetDateChange).toHaveBeenCalledWith("2026-07-23");
    expect(container?.textContent).toContain("งานเดิม 1 รายการ");

    await click(button("จัดแผนจากงานทั้งหมด"));
    expect(onGeneratePlan).toHaveBeenCalledWith(expect.objectContaining({ targetDate: "2026-07-23", currentTasks: [targetTask], drafts: [] }));
    expect(container?.textContent).toContain("ตรวจแผนก่อนบันทึก");
    expect(container?.textContent).toContain("แผน A");
    expect(container?.textContent).toContain("ประชุมทีม");
  });
});
