import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIPlannerDialog, findDraftScheduleConflicts, findScheduleArrivalConflicts, type PlannerApplyInput } from "@/components/planner/AIPlannerDialog";
import type { ParsedTasksResponse } from "@/lib/ai-parse";
import type { PlanResult, Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const targetTask: Task = { id: "target-task", title: "ประชุมทีม", place: "ออฟฟิศ", priority: "high", fixedTime: "10:00", durationMin: 60, lockTime: true };
const beforeTask: Task = { id: "before-task", title: "งานก่อนหน้า", place: "", priority: "normal", durationMin: 30 };
const afterTask: Task = { id: "after-task", title: "งานถัดไป", place: "", priority: "normal", durationMin: 30 };

it("detects a fixed-time draft collision before batch confirmation", () => {
  const conflicts = findDraftScheduleConflicts([{
    draftId: "draft-collision",
    title: "ดูหนัง",
    date: "2026-07-21",
    place: "",
    fixedTime: "10:30",
    durationMin: 60,
    durationSource: "explicit",
    lockTime: true,
    allDay: false,
    priority: "normal",
    reminderOffsets: [],
    repeat: "none",
    needsReview: false,
    note: "",
  }], () => [targetTask]);
  expect(conflicts).toEqual(["ดูหนัง ทับกับ ประชุมทีม"]);
});

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
    B: { schedule: [{ taskId: targetTask.id, title: targetTask.title, placeLabel: targetTask.place, start: "10:00", end: "11:00", travelFromPrevMin: 0 }], controlScore: 88, freeTimeMin: 600, riskScore: 0, riskPoints: [] },
  },
};

const lockedPreviewPlan: PlanResult = {
  mode: "local",
  summary: "คงงานที่ล็อกเวลาไว้",
  tip: "ตรวจแผนก่อนใช้",
  plans: {
    A: {
      schedule: [
        { taskId: beforeTask.id, title: beforeTask.title, placeLabel: "", start: "09:00", end: "09:30", travelFromPrevMin: 0 },
        { taskId: targetTask.id, title: targetTask.title, placeLabel: targetTask.place, start: "10:00", end: "11:00", travelFromPrevMin: 0 },
        { taskId: afterTask.id, title: afterTask.title, placeLabel: "", start: "11:30", end: "12:00", travelFromPrevMin: 0 },
      ],
      controlScore: 90, freeTimeMin: 540, riskScore: 0, riskPoints: [],
    },
    B: {
      schedule: [
        { taskId: beforeTask.id, title: beforeTask.title, placeLabel: "", start: "09:00", end: "09:30", travelFromPrevMin: 0 },
        { taskId: targetTask.id, title: targetTask.title, placeLabel: targetTask.place, start: "10:00", end: "11:00", travelFromPrevMin: 0 },
        { taskId: afterTask.id, title: afterTask.title, placeLabel: "", start: "11:45", end: "12:15", travelFromPrevMin: 0 },
      ],
      controlScore: 92, freeTimeMin: 555, riskScore: 0, riskPoints: [],
    },
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

function buttonWithLabel(label: string) {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button[aria-label]") ?? [])]
    .find((item) => item.getAttribute("aria-label") === label);
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
  it("uses semantic planner surfaces for light and dark themes", () => {
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn()} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    const scope = container?.querySelector<HTMLElement>("[data-theme-scope='ai-planner']");
    const status = container?.querySelector<HTMLElement>("[data-testid='planner-system-status']");
    expect(scope?.className).toContain("flow-planner-dialog");
    expect(status?.className).toContain("flow-planner-status");
    expect(status?.className).not.toContain("bg-[var(--flow-ink)]");
    expect(status?.className).not.toContain("text-white");
    expect(container?.querySelector("#planner-request")?.className).not.toContain("text-white");
    expect(container?.querySelector("#planner-date")?.getAttribute("type")).toBe("date");
    expect(container?.querySelector("#planner-start")?.getAttribute("type")).toBe("time");
  });

  it("flags a backwards daytime schedule instead of silently wrapping it to tomorrow", () => {
    const conflicts = findScheduleArrivalConflicts([
      { taskId: "later", title: "งานสาย", placeLabel: "", start: "10:00", end: "10:30", travelFromPrevMin: 0 },
      { taskId: "earlier", title: "งานเช้า", placeLabel: "", start: "09:00", end: "09:30", travelFromPrevMin: 0 },
    ], "08:00", "22:00");

    expect(conflicts).toContainEqual(expect.objectContaining({ taskId: "earlier", kind: "chronology" }));
  });

  it("accepts a genuinely chronological cross-midnight schedule", () => {
    const conflicts = findScheduleArrivalConflicts([
      { taskId: "late", title: "งานก่อนเที่ยงคืน", placeLabel: "", start: "23:00", end: "23:30", travelFromPrevMin: 0 },
      { taskId: "after-midnight", title: "งานหลังเที่ยงคืน", placeLabel: "", start: "00:15", end: "00:45", travelFromPrevMin: 30 },
    ], "20:00", "02:00");

    expect(conflicts).toEqual([]);
  });

  it("selects medium energy by default", () => {
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn()} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="medium"]')?.checked).toBe(true);
    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="low"]')?.checked).toBe(false);
    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="high"]')?.checked).toBe(false);
  });

  it("reports an energy change and includes it in the planning input", async () => {
    const onEnergyChange = vi.fn();
    const onGeneratePlan = vi.fn(async () => plan);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[targetTask]} onEnergyChange={onEnergyChange} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    const high = container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="high"]');
    expect(high).toBeTruthy();
    await act(async () => {
      high?.click();
      await Promise.resolve();
    });
    expect(high?.checked).toBe(true);
    expect(onEnergyChange).toHaveBeenCalledWith("2026-07-21", "high");

    await click(button("จัดเวลาและเพิ่ม"));
    expect(onGeneratePlan).toHaveBeenCalledWith(expect.objectContaining({ energyLevel: "high" }));
  });

  it("reloads energy by target date and defaults only dates without saved metadata", () => {
    const getEnergyForDate = vi.fn((date: string) => date === "2026-07-21" ? "high" as const : date === "2026-07-23" ? "low" as const : "medium" as const);
    const onEnergyChange = vi.fn();
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} getEnergyForDate={getEnergyForDate} onEnergyChange={onEnergyChange} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn()} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });
    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="high"]')?.checked).toBe(true);

    const date = container?.querySelector<HTMLInputElement>("#planner-date");
    setControlValue(date!, "2026-07-23");
    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="low"]')?.checked).toBe(true);
    setControlValue(date!, "2026-07-24");
    expect(container?.querySelector<HTMLInputElement>('input[name="planner-energy"][value="medium"]')?.checked).toBe(true);
    expect(onEnergyChange).not.toHaveBeenCalled();
  });

  it("keeps planning enabled without a location and sends an undefined start location", async () => {
    const onGeneratePlan = vi.fn(async () => plan);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[targetTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    const generate = button("จัดเวลาและเพิ่ม");
    expect(generate?.disabled).toBe(false);
    await click(generate);
    expect(onGeneratePlan).toHaveBeenCalledWith(expect.objectContaining({ startLocation: undefined }));
  });

  it("blocks planning while a requested live origin is still resolving", async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });
    const onGeneratePlan = vi.fn(async () => plan);
    try {
      act(() => {
        root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[targetTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
      });

      await click(button("ใช้ตำแหน่งปัจจุบัน"));
      expect(button("จัดเวลาและเพิ่ม")?.disabled).toBe(true);
      expect(onGeneratePlan).not.toHaveBeenCalled();
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });

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

    await click(button("เพิ่ม 1 งานลง Timeline"));
    expect(onAppendDrafts).toHaveBeenCalledWith(expect.objectContaining({ targetDate: "2026-07-21", drafts: [expect.objectContaining({ title: "เขียนรายงาน" })] }));
  });

  it("lets a parsed draft choose a structured location for route planning", async () => {
    const onGeneratePlan = vi.fn(async () => plan);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[]} savedPlaces={[{ id: "siam", label: "สยาม", placeName: "สยาม", latitude: 13.746, longitude: 100.534, category: "custom", createdAt: "2026-07-21T00:00:00.000Z", updatedAt: "2026-07-21T00:00:00.000Z" }]} onClose={vi.fn()} onParse={vi.fn(async () => parsed)} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });
    const request = container?.querySelector<HTMLTextAreaElement>("#planner-request");
    setControlValue(request!, "เขียนรายงาน 90 นาที");
    await click(button("แปลงข้อความเป็นฉบับร่าง"));

    const draftItem = [...(container?.querySelectorAll("li") ?? [])].find((item) => item.textContent?.includes("DRAFT 1"));
    const disclosure = [...(draftItem?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes("ที่ไหน")) as HTMLButtonElement | undefined;
    await click(disclosure);
    const siam = [...(draftItem?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.trim() === "สยาม") as HTMLButtonElement | undefined;
    await click(siam);
    await click(button("จัดเวลาและเพิ่ม"));

    expect(onGeneratePlan).toHaveBeenCalledWith(expect.objectContaining({
      drafts: [expect.objectContaining({
        place: "สยาม",
        lat: expect.any(Number),
        lng: expect.any(Number),
        locationSource: "saved",
      })],
    }));
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

    await click(button("จัดเวลาและเพิ่ม"));
    expect(onGeneratePlan).toHaveBeenCalledWith(expect.objectContaining({ targetDate: "2026-07-23", currentTasks: [targetTask], drafts: [] }));
    expect(container?.textContent).toContain("ตรวจแผนก่อนบันทึก");
    expect(container?.textContent).toContain("แผน A");
    expect(container?.textContent).toContain("ประชุมทีม");
  });

  it("disables time and delete controls for a locked task and does not expose stale reorder controls", async () => {
    const previewTasks = [beforeTask, targetTask, afterTask];
    const onGeneratePlan = vi.fn(async () => lockedPreviewPlan);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={previewTasks} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={onGeneratePlan} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });

    await click(button("จัดเวลาและเพิ่ม"));

    expect(container?.querySelector<HTMLInputElement>("#plan-A-1-start")?.disabled).toBe(true);
    expect(container?.querySelector<HTMLInputElement>("#plan-A-1-duration")?.disabled).toBe(true);
    expect(container?.querySelector<HTMLInputElement>("#plan-A-1-end")).toBeNull();
    expect(buttonWithLabel("เลื่อน ประชุมทีม ขึ้น")).toBeUndefined();
    expect(buttonWithLabel("เลื่อน ประชุมทีม ลง")).toBeUndefined();
    expect(buttonWithLabel("ลบ ประชุมทีม จากแผน")?.disabled).toBe(true);
    expect(buttonWithLabel("ลบ งานก่อนหน้า จากแผน")?.disabled).toBe(false);
  });

  it("edits start and duration while keeping end time derived", async () => {
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[beforeTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn(async () => ({
        ...plan,
        plans: {
          A: { ...plan.plans.A, schedule: [{ taskId: beforeTask.id, title: beforeTask.title, placeLabel: "", start: "09:00", end: "09:30", travelFromPrevMin: 0 }] },
          B: { ...plan.plans.B, schedule: [{ taskId: beforeTask.id, title: beforeTask.title, placeLabel: "", start: "09:00", end: "09:30", travelFromPrevMin: 0 }] },
        },
      }))} onAppendDrafts={vi.fn()} onApplyPlan={vi.fn()} />);
    });
    await click(button("จัดเวลาและเพิ่ม"));

    const start = container?.querySelector<HTMLInputElement>("#plan-A-0-start");
    const duration = container?.querySelector<HTMLInputElement>("#plan-A-0-duration");
    expect(container?.querySelector("#plan-A-0-end")).toBeNull();
    setControlValue(start!, "10:00");
    expect(container?.textContent).toContain("สิ้นสุดโดยประมาณ 10:30");
    setControlValue(duration!, "120");
    expect(container?.textContent).toContain("สิ้นสุดโดยประมาณ 12:00");
  });

  it("clears stale travel metadata after deleting an item from the preview", async () => {
    const onApplyPlan = vi.fn(async (input: PlannerApplyInput) => { void input; });
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[beforeTask, targetTask, afterTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn(async () => ({
        ...lockedPreviewPlan,
        plans: {
          ...lockedPreviewPlan.plans,
          A: { ...lockedPreviewPlan.plans.A, schedule: lockedPreviewPlan.plans.A.schedule.map((item, index) => ({ ...item, travelFromPrevMin: index * 12 })) },
        },
      }))} onAppendDrafts={vi.fn()} onApplyPlan={onApplyPlan} />);
    });
    await click(button("จัดเวลาและเพิ่ม"));
    await click(buttonWithLabel("ลบ งานก่อนหน้า จากแผน"));
    await click(button("ใช้แผน A นี้"));

    expect(onApplyPlan).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({ plans: expect.objectContaining({ A: expect.objectContaining({ schedule: expect.arrayContaining([expect.objectContaining({ travelFromPrevMin: 0 })]) }) }) }),
    }));
    const appliedSchedule = onApplyPlan.mock.calls[0][0].plan.plans.A.schedule;
    expect(appliedSchedule.every((item) => item.travelFromPrevMin === 0)).toBe(true);
  });

  it("passes the full day snapshot on apply so completed tasks remain untouched", async () => {
    const completedTask: Task = {
      id: "completed",
      title: "งานที่เสร็จแล้ว",
      place: "",
      priority: "normal",
      durationMin: 30,
      done: true,
    };
    const onApplyPlan = vi.fn(async () => undefined);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[targetTask, completedTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn(async () => plan)} onAppendDrafts={vi.fn()} onApplyPlan={onApplyPlan} />);
    });

    await click(button("จัดเวลาและเพิ่ม"));
    await click(button("ใช้แผน A นี้"));

    expect(onApplyPlan).toHaveBeenCalledWith(expect.objectContaining({
      currentTasks: [targetTask],
      allCurrentTasks: [targetTask, completedTask],
    }));
  });

  it("requires explicit acknowledgement when route time cannot fit before a task", async () => {
    const conflictVariant = {
      schedule: [{ taskId: beforeTask.id, title: beforeTask.title, placeLabel: "สยาม", start: "08:30", end: "09:00", travelFromPrevMin: 60 }],
      controlScore: 50,
      freeTimeMin: 0,
      riskScore: 50,
      riskPoints: [{ time: "การเดินทาง", reason: "เวลาเดินทางยาวกว่าช่องว่าง" }],
    };
    const conflictPlan: PlanResult = { mode: "local", summary: "มีความเสี่ยง", tip: "ตรวจเส้นทาง", plans: { A: conflictVariant, B: conflictVariant } };
    const onApplyPlan = vi.fn(async () => undefined);
    act(() => {
      root?.render(<AIPlannerDialog selectedDate="2026-07-21" currentTasks={[beforeTask]} onClose={vi.fn()} onParse={vi.fn()} onGeneratePlan={vi.fn(async () => conflictPlan)} onAppendDrafts={vi.fn()} onApplyPlan={onApplyPlan} />);
    });
    await click(button("จัดเวลาและเพิ่ม"));
    const apply = button("ใช้แผน A นี้");
    expect(apply?.disabled).toBe(true);
    const acknowledgement = container?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => {
      acknowledgement?.click();
      await Promise.resolve();
    });
    expect(button("ใช้แผน A นี้")?.disabled).toBe(false);
    await click(button("ใช้แผน A นี้"));
    expect(onApplyPlan).toHaveBeenCalledTimes(1);
  });
});
