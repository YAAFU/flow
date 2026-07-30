"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, ListTodo, Plus, Sparkles, X } from "lucide-react";
import type { QuickStartState } from "@/lib/onboarding";

type TargetBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type InteractiveQuickStartProps = {
  state: QuickStartState;
  active: boolean;
  blocked?: boolean;
  showSuccess: boolean;
  onAddTask: () => void;
  onScheduleTask: () => void;
  onSkip: () => void;
  onSuccessShown: () => void;
  onViewTimeline: () => void;
};

const CONTENT = {
  add_task: {
    selector: "[data-quick-start='add-task']",
    title: "เพิ่มงานแรกของคุณ",
    description: "เริ่มจากพิมพ์สิ่งที่ต้องทำวันนี้ ใช้เวลาไม่ถึง 10 วินาที",
    action: "เพิ่มงานแรก",
  },
  schedule_task: {
    selector: "[data-quick-start='schedule-task']",
    title: "ให้งานมีที่อยู่ในวัน",
    description: "ให้ Flow ช่วยจัดเวลาและตรวจช่วงชน คุณยังแก้แผนได้ก่อนบันทึกจริง",
    action: "จัดเวลาให้งานนี้",
  },
} as const;

function getTargetBox(element: Element): TargetBox {
  const rect = element.getBoundingClientRect();
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
}

export function InteractiveQuickStart({
  state,
  active,
  blocked = false,
  showSuccess,
  onAddTask,
  onScheduleTask,
  onSkip,
  onSuccessShown,
  onViewTimeline,
}: InteractiveQuickStartProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const actionTriggeredRef = useRef(false);
  const successNotifiedRef = useRef(false);
  const [targetBox, setTargetBox] = useState<TargetBox | null>(null);
  const stage = state.stage === "schedule_task" ? "schedule_task" : "add_task";
  const content = CONTENT[stage];
  const coachmarkVisible = active && !blocked && state.status === "started" && state.stage !== "completed";

  useEffect(() => {
    if (!showSuccess) {
      successNotifiedRef.current = false;
      return;
    }
    if (successNotifiedRef.current) return;
    successNotifiedRef.current = true;
    onSuccessShown();
  }, [onSuccessShown, showSuccess]);

  useEffect(() => {
    if (!coachmarkVisible) {
      return;
    }

    let target: Element | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let frame = 0;
    const update = () => {
      if (!target?.isConnected) return;
      frame = window.requestAnimationFrame(() => setTargetBox(getTargetBox(target!)));
    };
    const connect = () => {
      const next = document.querySelector(content.selector);
      if (!next || next === target) return;
      resizeObserver?.disconnect();
      target = next;
      returnFocusRef.current = next instanceof HTMLElement ? next : null;
      actionTriggeredRef.current = false;
      resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
      resizeObserver?.observe(next);
      update();
    };
    connect();
    const mutationObserver = new MutationObserver(connect);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.cancelAnimationFrame(frame);
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      if (!actionTriggeredRef.current) returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [coachmarkVisible, content.selector]);

  useEffect(() => {
    if (!coachmarkVisible || !targetBox) return;
    dialogRef.current?.focus({ preventScroll: true });
  }, [coachmarkVisible, targetBox]);

  useEffect(() => {
    if (!coachmarkVisible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]),a[href],[tabindex]:not([tabindex='-1'])",
      )];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [coachmarkVisible, onSkip]);

  if (showSuccess) {
    return (
      <div className="fixed inset-0 z-[80] grid items-end bg-black/45 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-[2px] sm:place-items-center sm:p-6" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="flow-pop max-h-[min(620px,calc(100dvh-1.5rem))] w-full max-w-[520px] overflow-y-auto rounded-[24px] border-[1.5px] border-[var(--flow-ink)] bg-[var(--flow-paper)] p-5 text-[var(--flow-ink)] shadow-[var(--flow-shadow)]">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--flow-lime)] text-[#111111]"><CheckCircle2 aria-hidden size={24} /></div>
          <h2 id={titleId} className="mt-4 text-2xl font-bold">แผนวันแรกพร้อมแล้ว</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--flow-muted)]">ตอนนี้คุณเห็นงาน เวลา และช่วงว่างในที่เดียว คุณยังแก้เวลาและรายละเอียดได้ทุกเมื่อ</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={onViewTimeline} className="flow-press flow-inverse flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 font-semibold"><ListTodo aria-hidden size={17} />ดูแผนของฉัน</button>
            <button type="button" onClick={onAddTask} className="flow-press flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[var(--flow-line)] px-4 font-semibold"><Plus aria-hidden size={17} />เพิ่มงานอีก</button>
          </div>
        </section>
      </div>
    );
  }

  if (!coachmarkVisible || !targetBox) return null;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spotlightPadding = 6;
  const cutoutTop = Math.max(0, targetBox.top - spotlightPadding);
  const cutoutLeft = Math.max(0, targetBox.left - spotlightPadding);
  const cutoutRight = Math.min(viewportWidth, targetBox.left + targetBox.width + spotlightPadding);
  const cutoutBottom = Math.min(viewportHeight, targetBox.top + targetBox.height + spotlightPadding);
  const cutoutHeight = Math.max(0, cutoutBottom - cutoutTop);
  const estimatedPopoverHeight = 250;
  const belowTarget = cutoutBottom + 14;
  const aboveTarget = cutoutTop - estimatedPopoverHeight - 14;
  const popoverTop = belowTarget + estimatedPopoverHeight <= viewportHeight - 12
    ? belowTarget
    : aboveTarget >= 12
      ? aboveTarget
      : Math.max(12, Math.min(belowTarget, viewportHeight - estimatedPopoverHeight - 12));
  const popoverStyle = {
    top: popoverTop,
    left: Math.min(
      Math.max(12, targetBox.left + targetBox.width / 2 - 180),
      Math.max(12, viewportWidth - 372),
    ),
  };
  const triggerPrimaryAction = () => {
    actionTriggeredRef.current = true;
    if (stage === "add_task") onAddTask();
    else onScheduleTask();
  };

  return (
    <>
      <div data-quick-start-overlay="top" className="fixed left-0 right-0 top-0 z-[68] bg-[var(--flow-overlay-background)]" style={{ height: cutoutTop }} aria-hidden />
      <div data-quick-start-overlay="bottom" className="fixed bottom-0 left-0 right-0 z-[68] bg-[var(--flow-overlay-background)]" style={{ top: cutoutBottom }} aria-hidden />
      <div data-quick-start-overlay="left" className="fixed left-0 z-[68] bg-[var(--flow-overlay-background)]" style={{ top: cutoutTop, width: cutoutLeft, height: cutoutHeight }} aria-hidden />
      <div data-quick-start-overlay="right" className="fixed right-0 z-[68] bg-[var(--flow-overlay-background)]" style={{ top: cutoutTop, left: cutoutRight, height: cutoutHeight }} aria-hidden />
      <div
        data-quick-start-highlight
        aria-hidden
        className="pointer-events-none fixed z-[69] rounded-2xl border-[3px] border-[var(--flow-lime)] motion-reduce:transition-none"
        style={{
          top: cutoutTop,
          left: cutoutLeft,
          width: Math.max(0, cutoutRight - cutoutLeft),
          height: cutoutHeight,
          boxShadow: "0 0 0 3px var(--flow-surface-page), 0 0 0 6px var(--flow-accent)",
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        style={popoverStyle}
        className="fixed z-[70] max-h-[calc(100dvh-24px)] w-[min(360px,calc(100vw-24px))] overflow-y-auto rounded-[22px] border-[1.5px] border-[var(--flow-border-strong)] bg-[var(--flow-surface-card)] p-4 text-[var(--flow-text-primary)] shadow-[var(--flow-shadow)] outline-none"
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--flow-lime)] text-[#111111]"><Sparkles aria-hidden size={19} /></span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="font-bold">{content.title}</h2>
            <p id={descriptionId} className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">{content.description}</p>
          </div>
          <button type="button" onClick={onSkip} aria-label="ข้ามการแนะนำ" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"><X aria-hidden size={18} /></button>
        </div>
        <button type="button" onClick={triggerPrimaryAction} className="flow-press flow-inverse mt-4 min-h-12 w-full rounded-xl px-4 font-semibold">{content.action}</button>
        <button type="button" onClick={onSkip} className="mt-1 min-h-11 w-full rounded-xl px-3 text-sm font-semibold text-[var(--flow-muted)] underline decoration-[var(--flow-lime-dark)] underline-offset-4">ข้ามการแนะนำ</button>
      </div>
    </>
  );
}
