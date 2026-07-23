import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultState } from "@/lib/storage";
import {
  ONBOARDING_KEY,
  createDefaultOnboardingState,
  loadOnboardingState,
  saveOnboardingState,
} from "@/lib/onboarding";
import type { FlowState } from "@/lib/types";

const guideRuntime = vi.hoisted(() => ({
  flowState: null as unknown,
  hydrated: true,
  updateCalls: 0,
  routerReplace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: guideRuntime.routerReplace,
  }),
}));

vi.mock("@/hooks/useFlowStore", () => ({
  useFlowStore: () => ({
    state: guideRuntime.flowState,
    hydrated: guideRuntime.hydrated,
    updateFlow: (updater: (previous: unknown) => unknown) => {
      guideRuntime.updateCalls += 1;
      guideRuntime.flowState = updater(guideRuntime.flowState);
    },
  }),
}));

import GuidePage from "@/app/guide/page";
import { ProductGuide } from "@/components/onboarding/ProductGuide";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

const PLAN_DATE = "2026-07-24";

function flowState(): FlowState {
  return guideRuntime.flowState as FlowState;
}

function buttonInHeader(): HTMLButtonElement | undefined {
  return container?.querySelector("header button") as HTMLButtonElement | undefined;
}

function fixedActionButtons(): HTMLButtonElement[] {
  return [
    ...(container?.querySelectorAll<HTMLButtonElement>("div.fixed button") ?? []),
  ];
}

function currentStep(step: number): HTMLElement | null | undefined {
  const names = ["one", "two", "three", "four"];
  return container?.querySelector(`#guide-step-${names[step - 1]}`);
}

async function renderGuide() {
  await act(async () => {
    root?.render(<ProductGuide />);
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  });
  await vi.waitFor(() => expect(currentStep(1) || currentStep(2) || currentStep(3) || currentStep(4)).toBeTruthy());
}

async function click(element: HTMLButtonElement | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function goToTemplateStep() {
  await click(fixedActionButtons().at(-1));
  await vi.waitFor(() => expect(currentStep(2)).toBeTruthy());
  await click(fixedActionButtons().at(-1));
  await vi.waitFor(() => expect(currentStep(3)).toBeTruthy());
}

function seedResumableDraft(step: 3 | 4 = 3) {
  saveOnboardingState(window.localStorage, {
    ...createDefaultOnboardingState(new Date("2026-07-23T08:00:00.000Z")),
    status: "started",
    currentStep: step,
    selectedTemplate: "work",
    draft: {
      date: PLAN_DATE,
      dayStart: "08:00",
      dayEnd: "20:00",
      energy: "medium",
      items: [
        {
          id: "resume-1",
          title: "งานที่บันทึกไว้ในฉบับร่าง",
          durationMin: 60,
          priority: "normal",
        },
        {
          id: "resume-2",
          title: "พักระหว่างงาน",
          durationMin: 30,
          priority: "normal",
        },
      ],
    },
  }, new Date("2026-07-23T08:00:00.000Z"));
}

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("scrollTo", vi.fn());
  vi.stubGlobal("fetch", vi.fn());
  window.localStorage.clear();
  window.history.replaceState({}, "", "/guide");
  setOnline(true);
  guideRuntime.flowState = createDefaultState(new Date("2026-07-23T00:00:00.000Z"));
  guideRuntime.hydrated = true;
  guideRuntime.updateCalls = 0;
  guideRuntime.routerReplace.mockReset();
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  container = undefined;
  document.body.replaceChildren();
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("/guide route", () => {
  it("renders the real ProductGuide instead of a detached landing page", () => {
    const element = GuidePage();
    expect(element.type).toBe(ProductGuide);
  });
});

describe("ProductGuide entry and navigation", () => {
  it("shows step one for a first visit without creating task data", async () => {
    await renderGuide();

    expect(currentStep(1)).toBeTruthy();
    expect(guideRuntime.updateCalls).toBe(0);
    expect(flowState().tasksByDay).toEqual({});
    expect(guideRuntime.routerReplace).not.toHaveBeenCalled();
  });

  it("opens the template step from contextual Quick Start without leaving a sticky query", async () => {
    window.history.replaceState({}, "", "/guide?start=templates");
    await renderGuide();

    expect(currentStep(3)).toBeTruthy();
    expect(loadOnboardingState(window.localStorage).status).toBe("started");
    expect(loadOnboardingState(window.localStorage).currentStep).toBe(3);
    expect(window.location.pathname).toBe("/guide");
    expect(window.location.search).toBe("");
    expect(flowState().tasksByDay).toEqual({});
  });

  it("resumes the saved step and draft after refresh", async () => {
    seedResumableDraft(3);
    await renderGuide();

    expect(currentStep(3)).toBeTruthy();
    expect(
      container?.querySelector<HTMLInputElement>("#resume-1-title")?.value,
    ).toBe("งานที่บันทึกไว้ในฉบับร่าง");
    expect(container?.querySelector('[role="status"]')).toBeTruthy();
    expect(guideRuntime.updateCalls).toBe(0);
    expect(flowState().tasksByDay).toEqual({});
  });

  it("supports back navigation and persists the previous guide step", async () => {
    seedResumableDraft(3);
    await renderGuide();

    await click(fixedActionButtons()[0]);

    await vi.waitFor(() => expect(currentStep(2)).toBeTruthy());
    await vi.waitFor(() =>
      expect(loadOnboardingState(window.localStorage).currentStep).toBe(2),
    );
    expect(guideRuntime.routerReplace).not.toHaveBeenCalled();
  });

  it("skips to the app while preserving all task state", async () => {
    const existing = {
      ...flowState(),
      tasksByDay: {
        [PLAN_DATE]: [{
          id: "existing-task",
          title: "งานเดิม",
          place: "",
          priority: "normal" as const,
          createdAt: "2026-07-23T00:00:00.000Z",
          updatedAt: "2026-07-23T00:00:00.000Z",
        }],
      },
    };
    guideRuntime.flowState = existing;
    await renderGuide();

    await click(buttonInHeader());

    expect(loadOnboardingState(window.localStorage).status).toBe("skipped");
    expect(guideRuntime.routerReplace).toHaveBeenCalledWith("/app");
    expect(flowState()).toBe(existing);
    expect(guideRuntime.updateCalls).toBe(0);
  });
});

describe("ProductGuide draft isolation", () => {
  it("edits and deletes template drafts without writing tasks before confirmation", async () => {
    await renderGuide();
    await goToTemplateStep();

    const firstTemplate = container?.querySelector<HTMLButtonElement>('[role="radio"]');
    await click(firstTemplate);
    await vi.waitFor(() => {
      expect(container?.querySelectorAll("ol li").length).toBeGreaterThan(0);
    });

    const firstTitle = container?.querySelector<HTMLInputElement>("ol li input");
    expect(firstTitle).toBeTruthy();
    setInputValue(firstTitle!, "ฉบับร่างที่แก้ไขแล้ว");
    await vi.waitFor(() => {
      expect(loadOnboardingState(window.localStorage).draft?.items[0]?.title)
        .toBe("ฉบับร่างที่แก้ไขแล้ว");
    });

    const countBeforeDelete = loadOnboardingState(window.localStorage).draft?.items.length ?? 0;
    const firstDelete = container?.querySelector<HTMLButtonElement>("ol li button");
    await click(firstDelete);
    await vi.waitFor(() => {
      expect(loadOnboardingState(window.localStorage).draft?.items).toHaveLength(countBeforeDelete - 1);
    });

    expect(guideRuntime.updateCalls).toBe(0);
    expect(flowState().tasksByDay).toEqual({});
    expect(window.localStorage.getItem(ONBOARDING_KEY)).toBeTruthy();
  });
});

describe("ProductGuide local planning and confirmation", () => {
  it("finishes offline with the local planner, then creates tasks and opens the timeline", async () => {
    seedResumableDraft(4);
    setOnline(false);
    await renderGuide();

    const stepFour = currentStep(4)?.closest("section") ?? currentStep(4)?.parentElement;
    const generate = stepFour?.querySelector<HTMLButtonElement>(":scope > button.flow-inverse");
    expect(flowState().tasksByDay).toEqual({});
    expect(guideRuntime.updateCalls).toBe(0);

    await click(generate);
    await vi.waitFor(() => {
      expect(stepFour?.querySelector(".mt-5")).toBeTruthy();
      expect(container?.textContent).toContain("LOCAL");
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(flowState().tasksByDay).toEqual({});
    expect(guideRuntime.updateCalls).toBe(0);

    const planPanel = stepFour?.querySelector(".mt-5");
    const confirm = [
      ...(planPanel?.querySelectorAll<HTMLButtonElement>("button.flow-inverse") ?? []),
    ].at(-1);
    await click(confirm);

    expect(guideRuntime.updateCalls).toBe(1);
    expect(flowState().tasksByDay[PLAN_DATE]).toHaveLength(2);
    expect(loadOnboardingState(window.localStorage).status).toBe("completed");
    expect(guideRuntime.routerReplace).toHaveBeenCalledWith(
      `/app?date=${PLAN_DATE}&view=timeline&onboarding=success`,
    );
  });

  it("falls back to a local plan when the AI endpoint is unavailable", async () => {
    seedResumableDraft(4);
    setOnline(true);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("offline"));
    await renderGuide();

    const stepFour = currentStep(4)?.closest("section") ?? currentStep(4)?.parentElement;
    const generate = stepFour?.querySelector<HTMLButtonElement>(":scope > button.flow-inverse");
    await click(generate);

    await vi.waitFor(() => expect(container?.textContent).toContain("LOCAL"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(guideRuntime.updateCalls).toBe(0);
    expect(flowState().tasksByDay).toEqual({});
  });
});
