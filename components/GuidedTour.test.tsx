import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockPopover = {
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  progressText?: string;
  onNextClick?: () => void;
  onPrevClick?: () => void;
  onCloseClick?: () => void;
};

type MockStep = {
  element?: string | Element | (() => Element);
  popover?: MockPopover;
};

type MockConfig = {
  steps?: MockStep[];
  allowKeyboardControl?: boolean;
  progressText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  onDestroyStarted?: () => void;
};

type MockDriver = {
  drive: ReturnType<typeof vi.fn<(index?: number) => void>>;
  moveTo: ReturnType<typeof vi.fn<(index: number) => void>>;
  destroy: ReturnType<typeof vi.fn<() => void>>;
  refresh: ReturnType<typeof vi.fn<() => void>>;
  isActive: () => boolean;
};

type DriverRecord = {
  config: MockConfig;
  instance: MockDriver;
};

const driverMockState = vi.hoisted(() => ({
  records: [] as unknown[],
}));

vi.mock("driver.js", () => ({
  driver: vi.fn((rawConfig: unknown) => {
    const config = rawConfig as MockConfig;
    let active = false;
    const resolveTarget = (index: number) => {
      const target = config.steps?.[index]?.element;
      if (typeof target === "function") target();
    };
    const instance: MockDriver = {
      drive: vi.fn((index = 0) => {
        active = true;
        resolveTarget(index);
      }),
      moveTo: vi.fn((index: number) => {
        active = true;
        resolveTarget(index);
      }),
      destroy: vi.fn(() => {
        active = false;
      }),
      refresh: vi.fn(),
      isActive: () => active,
    };
    driverMockState.records.push({ config, instance });
    return instance;
  }),
}));

import {
  CORE_TOUR_STEPS,
  FULL_TOUR_STEPS,
  GuidedTour,
  TOUR_TARGETS,
  findTourTarget,
  getTourSteps,
  startTour,
  waitForTourTarget,
  type GuidedTourSession,
} from "@/components/GuidedTour";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let sessions: GuidedTourSession[] = [];

function latestRecord() {
  return driverMockState.records.at(-1) as DriverRecord;
}

function addTarget(selector: string) {
  const name = selector.match(/data-tour='([^']+)'/)?.[1];
  const target = document.createElement("button");
  if (name) target.dataset.tour = name;
  target.textContent = name ?? "target";
  document.body.append(target);
  return target;
}

function addAllCoreTargets() {
  CORE_TOUR_STEPS.forEach((step) => addTarget(step.target));
}

async function nextFrom(index: number) {
  const record = latestRecord();
  record.config.steps?.[index]?.popover?.onNextClick?.();
  await vi.waitFor(() => {
    if (index + 1 < (record.config.steps?.length ?? 0)) {
      expect(record.instance.moveTo).toHaveBeenCalledWith(index + 1);
    }
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  driverMockState.records.length = 0;
  sessions = [];
  document.body.replaceChildren();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  sessions.forEach((session) => session.destroy());
  act(() => root?.unmount());
  root = undefined;
  container = undefined;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("GuidedTour definitions", () => {
  it("uses five unique semantic targets for the core tour", () => {
    expect(CORE_TOUR_STEPS).toHaveLength(5);
    expect(CORE_TOUR_STEPS.map((step) => step.target)).toEqual([
      TOUR_TARGETS.todayPulse,
      TOUR_TARGETS.primaryAction,
      TOUR_TARGETS.aiPlanner,
      TOUR_TARGETS.timeline,
      TOUR_TARGETS.focus,
    ]);
    expect(new Set(CORE_TOUR_STEPS.map((step) => step.target)).size).toBe(5);
    expect(getTourSteps("core")).toHaveLength(5);
  });

  it("keeps the full tour optional and adds each navigation target once", () => {
    const targets = FULL_TOUR_STEPS.map((step) => step.target);
    expect(targets).toEqual(
      expect.arrayContaining([
        TOUR_TARGETS.calendarNav,
        TOUR_TARGETS.dashboardNav,
        TOUR_TARGETS.searchNav,
        TOUR_TARGETS.settingsNav,
      ]),
    );
    expect(new Set(targets).size).toBe(targets.length);
    expect(getTourSteps("full")).toHaveLength(FULL_TOUR_STEPS.length);
  });
});

describe("GuidedTour target handling", () => {
  it("distinguishes one target, a missing target, and duplicate targets", () => {
    expect(findTourTarget(TOUR_TARGETS.todayPulse).status).toBe("missing");
    addTarget(TOUR_TARGETS.todayPulse);
    expect(findTourTarget(TOUR_TARGETS.todayPulse).status).toBe("found");
    addTarget(TOUR_TARGETS.todayPulse);
    expect(findTourTarget(TOUR_TARGETS.todayPulse).status).toBe("duplicate");
    expect(findTourTarget("[")).toEqual({ status: "missing", element: null });
  });

  it("waits for a target to mount and can be cancelled without leaking", async () => {
    const targetPromise = waitForTourTarget(TOUR_TARGETS.timeline, {
      timeoutMs: 100,
    });
    addTarget(TOUR_TARGETS.timeline);
    await expect(targetPromise).resolves.toBe(
      document.querySelector(TOUR_TARGETS.timeline),
    );

    const controller = new AbortController();
    const cancelled = waitForTourTarget(TOUR_TARGETS.focus, {
      timeoutMs: 100,
      signal: controller.signal,
    });
    controller.abort();
    await expect(cancelled).resolves.toBeNull();
  });

  it("skips an ambiguous target and continues with the next valid step", async () => {
    addTarget(TOUR_TARGETS.todayPulse);
    addTarget(TOUR_TARGETS.todayPulse);
    addTarget(TOUR_TARGETS.primaryAction);

    const session = startTour({ targetTimeoutMs: 0 });
    sessions.push(session);
    await session.ready;

    expect(latestRecord().instance.drive).toHaveBeenCalledWith(1);
  });
});

describe("GuidedTour runtime", () => {
  it("uses Thai controls, Thai progress, and keyboard support", async () => {
    addAllCoreTargets();
    const session = startTour();
    sessions.push(session);
    await session.ready;
    const { config } = latestRecord();

    expect(config.allowKeyboardControl).toBe(true);
    expect(config.progressText).toBe("{{current}} จาก {{total}}");
    expect(config.nextBtnText).toBe("ถัดไป");
    expect(config.prevBtnText).toBe("ย้อนกลับ");
    expect(config.doneBtnText).toBe("เสร็จสิ้น");
    expect(config.steps?.[1]?.popover?.progressText).toBeUndefined();
  });

  it("asks the parent to switch view before showing Timeline and Focus", async () => {
    addTarget(TOUR_TARGETS.todayPulse);
    addTarget(TOUR_TARGETS.primaryAction);
    addTarget(TOUR_TARGETS.aiPlanner);
    const onNavigate = vi.fn((view: string) => {
      if (view === "timeline" && !document.querySelector(TOUR_TARGETS.timeline)) {
        addTarget(TOUR_TARGETS.timeline);
      }
      if (view === "focus" && !document.querySelector(TOUR_TARGETS.focus)) {
        addTarget(TOUR_TARGETS.focus);
      }
    });
    const session = startTour({ onNavigate, targetTimeoutMs: 50 });
    sessions.push(session);
    await session.ready;

    await nextFrom(0);
    await nextFrom(1);
    await nextFrom(2);
    expect(onNavigate).toHaveBeenCalledWith(
      "timeline",
      expect.objectContaining({ target: TOUR_TARGETS.timeline }),
    );
    await nextFrom(3);
    expect(onNavigate).toHaveBeenCalledWith(
      "focus",
      expect.objectContaining({ target: TOUR_TARGETS.focus }),
    );
  });

  it("completes only after the final available step", async () => {
    addAllCoreTargets();
    const onComplete = vi.fn();
    const onClose = vi.fn();
    const session = startTour({ onComplete, onClose });
    sessions.push(session);
    await session.ready;

    await nextFrom(0);
    await nextFrom(1);
    await nextFrom(2);
    await nextFrom(3);
    latestRecord().config.steps?.[4]?.popover?.onNextClick?.();
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledWith("completed");
    expect(latestRecord().instance.destroy).toHaveBeenCalledOnce();
  });

  it("treats Escape/overlay destruction as skip and restores trigger focus", async () => {
    addAllCoreTargets();
    const trigger = document.createElement("button");
    trigger.textContent = "เปิดทัวร์";
    document.body.append(trigger);
    trigger.focus();
    const onSkip = vi.fn();
    const onClose = vi.fn();
    const session = startTour({ onSkip, onClose });
    sessions.push(session);
    await session.ready;
    addTarget(TOUR_TARGETS.settingsNav).focus();

    latestRecord().config.onDestroyStarted?.();

    expect(onSkip).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith("skipped");
    expect(document.activeElement).toBe(trigger);
  });

  it("destroys an active tour when its controlled component closes", async () => {
    addAllCoreTargets();
    await act(async () => {
      root?.render(<GuidedTour active mode="core" />);
      await Promise.resolve();
    });
    await vi.waitFor(() =>
      expect(latestRecord().instance.drive).toHaveBeenCalledWith(0),
    );

    await act(async () => {
      root?.render(<GuidedTour active={false} mode="core" />);
      await Promise.resolve();
    });
    expect(latestRecord().instance.destroy).toHaveBeenCalledOnce();
  });
});
