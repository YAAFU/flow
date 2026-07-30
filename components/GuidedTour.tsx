"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_TARGETS = {
  todayPulse: "[data-tour='today-pulse']",
  primaryAction: "[data-tour='primary-action']",
  aiPlanner: "[data-tour='ai-planner']",
  timeline: "[data-tour='timeline']",
  calendarNav: "[data-tour='calendar-nav']",
  dashboardNav: "[data-tour='dashboard-nav']",
  searchNav: "[data-tour='search-nav']",
  settingsNav: "[data-tour='settings-nav']",
} as const;

export type GuidedTourMode = "core" | "full";
export type GuidedTourView =
  | "today"
  | "timeline"
  | "calendar"
  | "dashboard"
  | "search"
  | "settings";

export type GuidedTourStep = {
  id: keyof typeof TOUR_TARGETS;
  target: (typeof TOUR_TARGETS)[keyof typeof TOUR_TARGETS];
  view: GuidedTourView;
  title: string;
  description: string;
  side?: "top" | "right" | "bottom" | "left" | "over";
  align?: "start" | "center" | "end";
};

export const CORE_TOUR_STEPS = [
  {
    id: "todayPulse",
    target: TOUR_TARGETS.todayPulse,
    view: "today",
    title: "ตอนนี้และงานถัดไป",
    description: "ดูสิ่งที่กำลังทำ งานต่อไป และเวลาว่างที่ยังเหลือได้ในจุดเดียว",
    side: "bottom",
    align: "start",
  },
  {
    id: "primaryAction",
    target: TOUR_TARGETS.primaryAction,
    view: "today",
    title: "ทำสิ่งที่สำคัญก่อน",
    description: "ปุ่มหลักจะเปลี่ยนตามวันของคุณ ตั้งแต่เพิ่มงาน จัดวัน ไปจนดูงานถัดไป",
    side: "top",
    align: "center",
  },
  {
    id: "aiPlanner",
    target: TOUR_TARGETS.aiPlanner,
    view: "today",
    title: "ให้ Flow ช่วยจัดวัน",
    description: "Flow เสนอเวลาและตรวจช่วงชนให้ดูก่อน คุณยังแก้แผนได้ก่อนบันทึก",
    side: "top",
    align: "center",
  },
  {
    id: "timeline",
    target: TOUR_TARGETS.timeline,
    view: "timeline",
    title: "เห็นทั้งวันบน Timeline",
    description: "ดูงานตามเวลาและเห็นช่องว่างที่ยังใช้ได้ภายในวันเดียว",
    side: "top",
    align: "start",
  },
] as const satisfies readonly GuidedTourStep[];

export const FULL_TOUR_STEPS = [
  ...CORE_TOUR_STEPS,
  {
    id: "calendarNav",
    target: TOUR_TARGETS.calendarNav,
    view: "calendar",
    title: "ดูภาพรวมในปฏิทิน",
    description: "ตรวจวันเสร็จ วันมีงานรอ และวันที่ต้องกลับมาจัดการต่อ",
    side: "top",
    align: "center",
  },
  {
    id: "dashboardNav",
    target: TOUR_TARGETS.dashboardNav,
    view: "dashboard",
    title: "ดูจังหวะการทำงาน",
    description: "สรุปความคืบหน้าช่วยให้เห็นรูปแบบของวันและปรับแผนครั้งถัดไป",
    side: "top",
    align: "center",
  },
  {
    id: "searchNav",
    target: TOUR_TARGETS.searchNav,
    view: "search",
    title: "ค้นหางานได้เร็ว",
    description: "กลับไปหางานเดิมได้โดยไม่ต้องไล่เปิดทีละวัน",
    side: "top",
    align: "center",
  },
  {
    id: "settingsNav",
    target: TOUR_TARGETS.settingsNav,
    view: "settings",
    title: "ปรับ Flow ให้เข้ากับคุณ",
    description: "เปลี่ยนวิธีแสดงผลและกลับมาเปิดทัวร์นี้ใหม่ได้ทุกเมื่อ",
    side: "top",
    align: "center",
  },
] as const satisfies readonly GuidedTourStep[];

export type TourTargetResult =
  | { status: "found"; element: Element }
  | { status: "missing" | "duplicate"; element: null };

export type GuidedTourOutcome = "completed" | "skipped";

export type GuidedTourOptions = {
  mode?: GuidedTourMode;
  targetTimeoutMs?: number;
  onNavigate?: (view: GuidedTourView, step: GuidedTourStep) => void | Promise<void>;
  onStepChange?: (step: GuidedTourStep, current: number, total: number) => void;
  onComplete?: () => void;
  onSkip?: () => void;
  onClose?: (outcome: GuidedTourOutcome) => void;
  returnFocus?: HTMLElement | null | (() => HTMLElement | null);
};

export type GuidedTourSession = {
  ready: Promise<void>;
  destroy: () => void;
};

export type GuidedTourProps = GuidedTourOptions & {
  active: boolean;
};

const DEFAULT_TARGET_TIMEOUT_MS = 1_800;

export function getTourSteps(mode: GuidedTourMode = "core"): readonly GuidedTourStep[] {
  const source = mode === "full" ? FULL_TOUR_STEPS : CORE_TOUR_STEPS;
  const seenTargets = new Set<string>();

  return source.filter((step) => {
    if (seenTargets.has(step.target)) return false;
    seenTargets.add(step.target);
    return true;
  });
}

export function findTourTarget(
  selector: string,
  root: ParentNode = document,
): TourTargetResult {
  try {
    const matches = root.querySelectorAll(selector);
    if (matches.length === 1) {
      return { status: "found", element: matches[0] };
    }
    return {
      status: matches.length > 1 ? "duplicate" : "missing",
      element: null,
    };
  } catch {
    return { status: "missing", element: null };
  }
}

export function waitForTourTarget(
  selector: string,
  options: {
    root?: ParentNode;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<Element | null> {
  const root = options.root ?? document;
  const timeoutMs = Math.max(0, options.timeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS);
  const signal = options.signal;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    let finished = false;
    let observer: MutationObserver | undefined;

    const finish = (element: Element | null) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", handleAbort);
      resolve(element);
    };
    const inspect = () => {
      const match = findTourTarget(selector, root);
      if (match.status === "found") {
        finish(match.element);
      } else if (match.status === "duplicate") {
        finish(null);
      }
    };
    const handleAbort = () => finish(null);
    const timeoutId = setTimeout(() => finish(null), timeoutMs);

    signal?.addEventListener("abort", handleAbort, { once: true });
    inspect();
    if (finished) return;

    const observedNode =
      root instanceof Document ? root.documentElement : root instanceof Node ? root : null;
    if (observedNode && typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(inspect);
      observer.observe(observedNode, {
        attributes: true,
        attributeFilter: ["data-tour"],
        childList: true,
        subtree: true,
      });
    }
  });
}

function reducedMotionIsPreferred() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function resolveReturnFocus(
  value: GuidedTourOptions["returnFocus"],
  fallback: HTMLElement | null,
) {
  if (typeof value === "function") {
    try {
      return value();
    } catch {
      return fallback;
    }
  }
  return value ?? fallback;
}

function stylePopoverForFlow(popover: {
  wrapper: HTMLElement;
  closeButton: HTMLButtonElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
}) {
  popover.wrapper.style.maxWidth = "min(320px, calc(100vw - 24px))";
  popover.wrapper.style.overflowWrap = "anywhere";
  popover.wrapper.setAttribute("aria-modal", "true");
  popover.closeButton.textContent = "ข้าม";
  popover.closeButton.setAttribute("aria-label", "ข้ามทัวร์");
  popover.closeButton.style.width = "auto";
  popover.closeButton.style.minHeight = "44px";
  popover.closeButton.style.paddingInline = "12px";
  popover.previousButton.style.minHeight = "44px";
  popover.nextButton.style.minHeight = "44px";
}

function setPopoverBusy(busy: boolean) {
  const popover = document.querySelector<HTMLElement>(".flow-guided-tour");
  if (!popover) return;
  popover.setAttribute("aria-busy", String(busy));
  popover
    .querySelectorAll<HTMLButtonElement>(".driver-popover-next-btn, .driver-popover-prev-btn")
    .forEach((button) => {
      button.disabled = busy;
    });
}

/**
 * Imperative entry point retained for callers outside React. The returned session
 * must be destroyed by the caller when its owning screen unmounts.
 */
export function startTour(options: GuidedTourOptions = {}): GuidedTourSession {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ready: Promise.resolve(), destroy: () => undefined };
  }

  const mode = options.mode ?? "core";
  const steps = getTourSteps(mode);
  const targetTimeoutMs = Math.max(
    0,
    options.targetTimeoutMs ?? DEFAULT_TARGET_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const resolvedTargets = new Map<number, Element>();
  const initialFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let activeIndex = -1;
  let busy = false;
  let settled = false;
  let started = false;
  let resizeFrame: number | undefined;

  const driverInstance = driver({
    steps: steps.map((step, index) => ({
      element: () => resolvedTargets.get(index) ?? document.body,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side,
        align: step.align,
        showProgress: true,
        nextBtnText: "ถัดไป",
        prevBtnText: "ย้อนกลับ",
        doneBtnText: "เสร็จสิ้น",
        onPopoverRender: stylePopoverForFlow,
        onNextClick: () => {
          void showStep(activeIndex + 1, 1);
        },
        onPrevClick: () => {
          void showStep(activeIndex - 1, -1);
        },
        onCloseClick: () => finish("skipped", true),
      },
    })),
    animate: !reducedMotionIsPreferred(),
    smoothScroll: !reducedMotionIsPreferred(),
    allowClose: true,
    allowKeyboardControl: true,
    overlayClickBehavior: "close",
    disableActiveInteraction: true,
    showProgress: true,
    progressText: "{{current}} จาก {{total}}",
    nextBtnText: "ถัดไป",
    prevBtnText: "ย้อนกลับ",
    doneBtnText: "เสร็จสิ้น",
    popoverClass: "flow-guided-tour",
    stagePadding: 8,
    stageRadius: 14,
    onPopoverRender: stylePopoverForFlow,
    onDestroyStarted: () => finish("skipped", true),
  });

  const refresh = () => {
    if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = undefined;
      if (!settled && driverInstance.isActive()) driverInstance.refresh();
    });
  };

  const removeViewportListeners = () => {
    window.removeEventListener("resize", refresh);
    window.removeEventListener("orientationchange", refresh);
    if (resizeFrame !== undefined) {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = undefined;
    }
  };

  const restoreFocus = () => {
    const target = resolveReturnFocus(options.returnFocus, initialFocus);
    if (!target?.isConnected) return;
    const focus = () => target.focus({ preventScroll: true });
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(focus);
    } else {
      window.setTimeout(focus, 0);
    }
  };

  function finish(outcome: GuidedTourOutcome, notify: boolean) {
    if (settled) return;
    settled = true;
    controller.abort();
    removeViewportListeners();
    if (driverInstance.isActive()) driverInstance.destroy();
    restoreFocus();
    if (!notify) return;

    try {
      if (outcome === "completed") options.onComplete?.();
      else options.onSkip?.();
    } catch {
      // Consumer tracking must not break the tour teardown.
    }
    try {
      options.onClose?.(outcome);
    } catch {
      // Consumer tracking must not break the tour teardown.
    }
  }

  async function showStep(requestedIndex: number, direction: 1 | -1) {
    if (settled || busy) return;
    if (direction < 0 && requestedIndex < 0) return;

    busy = true;
    setPopoverBusy(true);
    let index = requestedIndex;

    while (index >= 0 && index < steps.length && !controller.signal.aborted) {
      const step = steps[index];
      try {
        const navigation = options.onNavigate?.(step.view, step);
        void Promise.resolve(navigation).catch(() => undefined);
      } catch {
        // A navigation integration must never break or strand the tour.
      }

      const target = await waitForTourTarget(step.target, {
        timeoutMs: targetTimeoutMs,
        signal: controller.signal,
      });
      if (settled || controller.signal.aborted) return;
      if (target) {
        resolvedTargets.set(index, target);
        activeIndex = index;
        if (started) driverInstance.moveTo(index);
        else {
          started = true;
          driverInstance.drive(index);
        }
        busy = false;
        setPopoverBusy(false);
        try {
          options.onStepChange?.(step, index + 1, steps.length);
        } catch {
          // Consumer tracking must not break navigation.
        }
        return;
      }
      index += direction;
    }

    busy = false;
    setPopoverBusy(false);
    if (direction > 0) finish("completed", true);
  }

  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("orientationchange", refresh, { passive: true });
  const ready = showStep(0, 1);

  return {
    ready,
    destroy: () => finish("skipped", false),
  };
}

export function GuidedTour({
  active,
  mode = "core",
  targetTimeoutMs,
  ...callbacks
}: GuidedTourProps) {
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!active) return;
    const session = startTour({
      mode,
      targetTimeoutMs,
      onNavigate: (view, step) => callbacksRef.current.onNavigate?.(view, step),
      onStepChange: (step, current, total) =>
        callbacksRef.current.onStepChange?.(step, current, total),
      onComplete: () => callbacksRef.current.onComplete?.(),
      onSkip: () => callbacksRef.current.onSkip?.(),
      onClose: (outcome) => callbacksRef.current.onClose?.(outcome),
      returnFocus: callbacksRef.current.returnFocus,
    });
    return session.destroy;
  }, [active, mode, targetTimeoutMs]);

  return null;
}
