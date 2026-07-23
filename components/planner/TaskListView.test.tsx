import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskListView } from "@/components/planner/TaskListView";
import { createDefaultState } from "@/lib/storage";
import { createTask } from "@/lib/task-factory";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function button(label: string) {
  return [...(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
    .find((item) => item.textContent?.includes(label));
}

function render(tasks = [] as ReturnType<typeof createTask>[]) {
  const callbacks = {
    onToggle: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAdd: vi.fn(),
    onTryExample: vi.fn(),
    onOpenGuide: vi.fn(),
  };
  const categories = createDefaultState().categories;
  act(() => root?.render(
    <TaskListView tasks={tasks} categories={categories} {...callbacks} />,
  ));
  return callbacks;
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

describe("TaskListView first-use state", () => {
  it("shows one add trigger plus sample and guide actions for an empty day", () => {
    const callbacks = render();

    expect(container?.querySelectorAll("[data-tour='primary-action']")).toHaveLength(1);
    expect(button("เพิ่มงานแรก")).toBeTruthy();
    expect(button("ลองด้วยวันตัวอย่าง")).toBeTruthy();
    expect(button("ดูวิธีใช้")).toBeTruthy();

    act(() => button("เพิ่มงานแรก")?.click());
    act(() => button("ลองด้วยวันตัวอย่าง")?.click());
    act(() => button("ดูวิธีใช้")?.click());
    expect(callbacks.onAdd).toHaveBeenCalledOnce();
    expect(callbacks.onTryExample).toHaveBeenCalledOnce();
    expect(callbacks.onOpenGuide).toHaveBeenCalledOnce();
  });

  it("replaces the teaching state with real tasks and no duplicate add trigger", () => {
    render([createTask({ title: "ทำรายงาน" }, 0)]);

    expect(container?.textContent).toContain("ทำรายงาน");
    expect(button("เพิ่มงานแรก")).toBeUndefined();
    expect(container?.querySelectorAll("[data-tour='primary-action']")).toHaveLength(0);
  });
});
