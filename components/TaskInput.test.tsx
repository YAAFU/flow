import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskInput } from "@/components/TaskInput";
import type { RepeatDraft } from "@/lib/task-form";
import type { Task } from "@/lib/types";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function successfulSubmitMock() {
  return vi.fn(async (task: Task, repeat: RepeatDraft) => {
    void task;
    void repeat;
  });
}

function renderTaskInput(props: Partial<ComponentProps<typeof TaskInput>> = {}) {
  const onAdd = props.onAdd ?? successfulSubmitMock();
  act(() => {
    root?.render(<TaskInput {...props} onAdd={onAdd} />);
  });
  return { onAdd };
}

function button(text: string, exact = false): HTMLButtonElement | undefined {
  return [...(container?.querySelectorAll("button") ?? [])].find((item) => {
    const content = item.textContent?.replace(/\s+/g, " ").trim() ?? "";
    return exact ? content === text : content.includes(text);
  }) as HTMLButtonElement | undefined;
}

function titleInput(): HTMLInputElement {
  const input = container?.querySelector<HTMLInputElement>('input[placeholder="ทำอะไร?"]');
  expect(input).toBeTruthy();
  return input!;
}

function setInputValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function click(element: HTMLButtonElement | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

async function openDetails() {
  const trigger = button("เพิ่มรายละเอียด");
  expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  await click(trigger);
  expect(trigger?.getAttribute("aria-expanded")).toBe("true");
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

describe("TaskInput", () => {
  it("reuses the existing multi-task entry point without submitting a placeholder task", async () => {
    const onAdd = successfulSubmitMock();
    const onOpenBulk = vi.fn();
    renderTaskInput({ onAdd, onOpenBulk });

    await click(button("พิมพ์ทีเดียวหลายงาน"));

    expect(onOpenBulk).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("starts with one required, visibly labelled title field and hides optional details", () => {
    renderTaskInput();

    const title = titleInput();
    const label = container?.querySelector<HTMLLabelElement>(`label[for="${title.id}"]`);
    expect(label?.textContent).toContain("ชื่องาน");
    expect(label?.classList.contains("sr-only")).toBe(false);
    expect(title.required).toBe(true);
    expect(title.getAttribute("enterkeyhint")).toBe("done");
    expect(button("เพิ่มรายละเอียด")?.getAttribute("aria-expanded")).toBe("false");
    expect(button("สถานที่")).toBeUndefined();
    expect(button("เมื่อไหร่")).toBeUndefined();
    expect(container?.textContent).toContain("กรอกแค่ชื่องานก็เพิ่มได้");
  });

  it("shows title validation beside the field and restores focus when submitted empty", async () => {
    renderTaskInput();
    await click(button("เพิ่มงาน"));

    const title = titleInput();
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(title);
    expect(container?.querySelector(`#${title.getAttribute("aria-describedby")?.split(" ").at(-1)}`)?.textContent).toContain("กรุณากรอกชื่องาน");
  });

  it("reveals all optional groups from one progressive-disclosure control", async () => {
    renderTaskInput();
    await openDetails();

    expect(button("สถานที่")).toBeTruthy();
    expect(button("เมื่อไหร่")).toBeTruthy();
    expect(button("ความสำคัญ")).toBeTruthy();
    expect(button("รายละเอียดเพิ่มเติม")).toBeTruthy();
  });

  it("blocks saving while a requested live location is still resolving", async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: vi.fn() },
    });
    try {
      const { onAdd } = renderTaskInput();
      setInputValue(titleInput(), "งานที่มีตำแหน่ง");
      await openDetails();
      await click(button("สถานที่"));
      await click(button("ใช้ตำแหน่งปัจจุบัน"));

      const submit = button("กำลังค้นหาตำแหน่ง");
      expect(submit?.disabled).toBe(true);
      expect(onAdd).not.toHaveBeenCalled();
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });

  it("allows saving after an unsupported browser rejects live location synchronously", async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    try {
      const onAdd = successfulSubmitMock();
      renderTaskInput({ onAdd });
      setInputValue(titleInput(), "งานที่ไม่ต้องใช้ตำแหน่ง");
      await openDetails();
      await click(button("สถานที่"));
      await click(button("ใช้ตำแหน่งปัจจุบัน"));

      await act(async () => {
        await Promise.resolve();
      });
      expect(container?.textContent).toContain("เบราว์เซอร์นี้ไม่รองรับตำแหน่ง");
      expect(button("เพิ่มงาน")?.disabled).toBe(false);

      await click(button("เพิ่มงาน"));
      expect(onAdd).toHaveBeenCalledTimes(1);
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
      else Reflect.deleteProperty(navigator, "geolocation");
    }
  });

  it("never renders an editable end-time field", async () => {
    renderTaskInput();
    await openDetails();
    await click(button("เมื่อไหร่"));
    await click(button("กำหนดเวลาเริ่มเอง"));

    const labels = [...(container?.querySelectorAll("label") ?? [])].map((label) => label.textContent?.trim());
    expect(labels).not.toContain("จบ");
    expect(container?.querySelector('input[name="end"], input[aria-label*="จบ"]')).toBeNull();
    expect(container?.querySelectorAll('input[type="time"]')).toHaveLength(1);
  });

  it("submits a title-only task without inventing a start or duration", async () => {
    const onAdd = successfulSubmitMock();
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "เขียนรายงาน");
    await click(button("เพิ่มงาน"));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ title: "เขียนรายงาน", fixedTime: undefined, durationMin: undefined, lockTime: false });
    expect(onAdd.mock.calls[0][1]).toEqual({ frequency: "none" });
  });

  it("supports the native form-submit path used when pressing Enter in the title", async () => {
    const onAdd = successfulSubmitMock();
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "เตรียมเอกสาร");

    await act(async () => {
      titleInput().form?.requestSubmit();
      await Promise.resolve();
    });

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toMatchObject({ title: "เตรียมเอกสาร" });
  });

  it("stores the บ้าน quick choice as a name without synthetic coordinates", async () => {
    const onAdd = successfulSubmitMock();
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "อ่านหนังสือ");
    await openDetails();
    await click(button("สถานที่"));
    await click(button("บ้าน", true));
    await click(button("เพิ่มงาน"));

    const task = onAdd.mock.calls[0][0];
    expect(task).toMatchObject({ place: "บ้าน", locationSource: "quick" });
    expect(task.lat).toBeUndefined();
    expect(task.lng).toBeUndefined();
  });

  it("stores 13:00 plus two hours without an endTime field", async () => {
    const onAdd = successfulSubmitMock();
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "ประชุมทีม");
    await openDetails();
    await click(button("เมื่อไหร่"));
    await click(button("กำหนดเวลาเริ่มเอง"));
    const start = container?.querySelector<HTMLInputElement>('input[type="time"]');
    expect(start).toBeTruthy();
    setInputValue(start!, "13:00");
    await click(button("2 ชั่วโมง", true));
    await click(button("เพิ่มงาน"));

    const task = onAdd.mock.calls[0][0];
    expect(task).toMatchObject({ fixedTime: "13:00", durationMin: 120 });
    expect("endTime" in task).toBe(false);
  });

  it("round-trips location, advanced fields, and identity while editing", async () => {
    const editing: Task = {
      id: "task-existing",
      title: "ประชุมเดิม",
      place: "สำนักงานใหญ่",
      lat: 13.7563,
      lng: 100.5018,
      locationSource: "search",
      fixedTime: "09:30",
      durationMin: 90,
      lockTime: true,
      deadlineDate: "2026-07-25",
      deadlineTime: "17:00",
      priority: "urgent",
      categoryId: "work",
      reminderOffsets: [10, 30],
      note: "เตรียมสไลด์",
      order: 4,
      seriesId: "series-one",
      occurrenceDate: "2026-07-21",
      createdAt: "2026-07-20T01:00:00.000Z",
      updatedAt: "2026-07-20T02:00:00.000Z",
    };
    const onSave = successfulSubmitMock();
    renderTaskInput({ editing, onSave, onAdd: successfulSubmitMock() });
    await click(button("บันทึกงาน", true));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({
      id: "task-existing",
      title: "ประชุมเดิม",
      place: "สำนักงานใหญ่",
      lat: 13.7563,
      lng: 100.5018,
      locationSource: "search",
      fixedTime: "09:30",
      durationMin: 90,
      lockTime: true,
      deadlineDate: "2026-07-25",
      deadlineTime: "17:00",
      priority: "urgent",
      categoryId: "work",
      reminderOffsets: [10, 30],
      note: "เตรียมสไลด์",
      order: 4,
      seriesId: "series-one",
      occurrenceDate: "2026-07-21",
      createdAt: "2026-07-20T01:00:00.000Z",
    });
  });

  it("guards repeated submit events while the first save is pending", async () => {
    let resolveSave: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => { resolveSave = resolve; });
    const onAdd = vi.fn((task: Task, repeat: RepeatDraft) => {
      void task;
      void repeat;
      return pending;
    });
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "ส่งรายงาน");
    const form = container?.querySelector("form");
    expect(form).toBeTruthy();

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(container?.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    expect(container?.querySelector<HTMLButtonElement>('button[type="submit"]')?.textContent).toContain("กำลังบันทึก");
    expect(container?.querySelector('[role="status"]')?.textContent).toContain("กำลังเพิ่มงาน");

    await act(async () => {
      resolveSave?.();
      await pending;
    });
  });

  it("keeps the entered title and shows understandable feedback when saving fails", async () => {
    const onAdd = vi.fn(async () => {
      throw new Error("เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    });
    renderTaskInput({ onAdd });
    setInputValue(titleInput(), "งานที่ต้องลองใหม่");
    await click(button("เพิ่มงาน"));

    expect(titleInput().value).toBe("งานที่ต้องลองใหม่");
    expect(container?.querySelector('[role="alert"]')?.textContent).toContain("เชื่อมต่อไม่สำเร็จ");
    expect(button("เพิ่มงาน")?.disabled).toBe(false);
  });
});
