"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, Pause, Play, RotateCcw, Square } from "lucide-react";
import {
  canExtendFocus,
  elapsedFocusMs,
  finishFocusSession,
  preferredFocusMode,
  selectFocusContext,
} from "@/lib/focus";
import type { ActiveFocusSession, FocusMode, FocusOutcome, FocusSession, Task } from "@/lib/types";

type FocusPanelProps = {
  date: string;
  tasks: Task[];
  sessions: FocusSession[];
  active?: ActiveFocusSession;
  defaultMode?: FocusMode;
  breakBufferMin?: number;
  onActiveChange: (active?: ActiveFocusSession) => void;
  onComplete: (session: FocusSession, outcome: FocusOutcome) => void;
  onTaskComplete: (taskId: string) => void;
  onReschedule: (taskId: string, remainingMin: number) => void;
  onAddTask?: () => void;
  onOpenPlanner?: () => void;
};

function modeMinutes(mode: FocusMode, recommended: number, custom: number): number {
  if (mode === "pomodoro") return 25;
  if (mode === "long") return 50;
  if (mode === "remaining_task_time") return recommended;
  return Math.max(1, Math.min(240, custom));
}

export function FocusPanel({
  date,
  tasks,
  sessions,
  active,
  defaultMode = "pomodoro",
  breakBufferMin = 10,
  onActiveChange,
  onComplete,
  onTaskComplete,
  onReschedule,
  onAddTask,
  onOpenPlanner,
}: FocusPanelProps) {
  const [mode, setMode] = useState<FocusMode>(() => preferredFocusMode(sessions, defaultMode));
  const [taskId, setTaskId] = useState("");
  const [customMin, setCustomMin] = useState(25);
  const [now, setNow] = useState(() => Date.now());
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [reschedulePreview, setReschedulePreview] = useState<{ taskId: string; remainingMin: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const startGuardRef = useRef(false);
  const notifiedRef = useRef(new Set<number>());
  const context = useMemo(
    () => selectFocusContext(tasks, sessions, date, new Date(now), breakBufferMin),
    [breakBufferMin, date, now, sessions, tasks],
  );
  const activeTask = active?.taskId ? tasks.find((task) => task.id === active.taskId) : undefined;
  const activeTaskMissing = Boolean(active?.taskId && !activeTask);
  const selectedTask = active ? activeTask : tasks.find((task) => task.id === taskId) ?? context.task;
  const requestedMin = modeMinutes(mode, context.recommendedMin, customMin);
  const hasSafeWindow = context.maxSafeMin == null || context.maxSafeMin > 0;
  const plannedMin = Math.max(1, Math.min(requestedMin, context.maxSafeMin ?? requestedMin));

  useEffect(() => {
    if (!active || active.pausedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const elapsed = active ? elapsedFocusMs(active, new Date(now)) : 0;
  const remain = Math.max(0, (active?.plannedMin ?? plannedMin) * 60_000 - elapsed);
  const minutes = Math.floor(remain / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const extension = active ? canExtendFocus(active, tasks, new Date(now), 5, breakBufferMin) : { allowed: false };
  const showOutcome = Boolean(active && !active.pausedAt && remain <= 0) || outcomeOpen;

  useEffect(() => {
    if (!active || active.pausedAt || !context.safeUntil || !context.nextLockedTask) return;
    const remainingMin = Math.ceil(remain / 60_000);
    if ((remainingMin === 10 || remainingMin === 5) && !notifiedRef.current.has(remainingMin)) {
      notifiedRef.current.add(remainingMin);
      const message = `เหลือ ${remainingMin} นาที ก่อน ${context.nextLockedTask.title} เวลา ${context.safeUntil}`;
      setAnnouncement(message);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Flow Focus", { body: message, tag: `focus-${active.id}-${remainingMin}` });
      }
    }
  }, [active, context.nextLockedTask, context.safeUntil, remain]);

  const start = () => {
    if (active || startGuardRef.current || !selectedTask || !hasSafeWindow) return;
    startGuardRef.current = true;
    const stamp = new Date().toISOString();
    setNow(Date.now());
    onActiveChange({
      id: crypto.randomUUID(),
      taskId: selectedTask.id,
      date,
      mode,
      startedAt: stamp,
      plannedMin,
      pausedMs: 0,
    });
    setAnnouncement(`เริ่มโฟกัส ${selectedTask.title} ${plannedMin} นาที`);
    window.setTimeout(() => { startGuardRef.current = false; }, 0);
  };

  const pause = () => {
    if (!active) return;
    if (active.pausedAt) {
      onActiveChange({ ...active, pausedMs: active.pausedMs + Date.now() - new Date(active.pausedAt).getTime(), pausedAt: undefined });
      setNow(Date.now());
      setAnnouncement("ทำ Focus ต่อแล้ว");
    } else {
      onActiveChange({ ...active, pausedAt: new Date().toISOString() });
      setAnnouncement("พัก Focus ชั่วคราว");
    }
  };

  const saveOutcome = (outcome: FocusOutcome) => {
    if (!active) return;
    const session = finishFocusSession(active, outcome);
    onComplete(session, outcome);
    if (outcome === "completed" && active.taskId) onTaskComplete(active.taskId);
    onActiveChange(undefined);
    setOutcomeOpen(false);
    setAnnouncement(outcome === "completed" ? "ทำเครื่องหมายว่างานเสร็จแล้ว" : "บันทึก Focus Session แล้ว");
  };

  const continueFocus = () => {
    if (!active || context.recommendedMin <= 0) {
      setAnnouncement("ยังทำต่อไม่ได้ เพราะใกล้ถึงงานที่ล็อกเวลาไว้");
      return;
    }
    const finished = finishFocusSession(active, "continued");
    onComplete(finished, "continued");
    const nextContext = selectFocusContext(tasks, [...sessions, finished], date, new Date(), breakBufferMin);
    onActiveChange({
      id: crypto.randomUUID(),
      taskId: active.taskId,
      date,
      mode: "remaining_task_time",
      startedAt: new Date().toISOString(),
      plannedMin: nextContext.recommendedMin,
      pausedMs: 0,
    });
    setOutcomeOpen(false);
    setAnnouncement(`ทำต่อได้อีก ${nextContext.recommendedMin} นาทีโดยไม่ชนงานถัดไป`);
  };

  const startBreak = () => {
    if (!active) return;
    const finished = finishFocusSession(active, "paused");
    onComplete(finished, "paused");
    onActiveChange({
      id: crypto.randomUUID(),
      date,
      mode: "custom",
      startedAt: new Date().toISOString(),
      plannedMin: 5,
      pausedMs: 0,
    });
    setOutcomeOpen(false);
    setAnnouncement("เริ่มพัก 5 นาที โดยไม่ได้สร้าง Task เพิ่ม");
  };

  const openReschedulePreview = () => {
    if (!active?.taskId || selectedTask?.lockTime) {
      if (selectedTask?.lockTime) setAnnouncement("งานนี้ล็อกเวลาไว้ จึงไม่สามารถส่งไปจัดเวลาใหม่ได้");
      return;
    }
    const remainingMin = context.remainingTaskMin ?? Math.max(1, active.plannedMin - Math.round(elapsed / 60_000));
    setReschedulePreview({ taskId: active.taskId, remainingMin });
    setOutcomeOpen(false);
  };

  const confirmReschedule = () => {
    if (!active || !reschedulePreview) return;
    const session = finishFocusSession(active, "rescheduled");
    onComplete(session, "rescheduled");
    onActiveChange(undefined);
    onReschedule(reschedulePreview.taskId, reschedulePreview.remainingMin);
    setReschedulePreview(null);
    setAnnouncement("ยืนยันส่งงานกลับไปให้ Flow จัดเวลาใหม่แล้ว");
  };

  if (!active && !selectedTask) {
    return (
      <section className="flow-card flow-rise rounded-[22px] p-5 text-center">
        <Clock3 aria-hidden className="mx-auto text-[var(--flow-lime-dark)]" />
        <h2 className="mt-3 text-xl font-bold">ยังไม่มีงานที่พร้อมเริ่ม</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--flow-muted)]">เพิ่มงานหรือให้ Flow จัดเวลา โดยระบบจะไม่สร้างงานตัวอย่างให้เอง</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onAddTask} disabled={!onAddTask} className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] font-semibold disabled:opacity-40">เพิ่มงาน</button>
          <button type="button" onClick={onOpenPlanner} disabled={!onOpenPlanner} className="flow-press flow-inverse min-h-12 rounded-xl font-semibold disabled:opacity-40">ให้ Flow จัดวัน</button>
        </div>
      </section>
    );
  }

  return (
    <section className="flow-card flow-rise overflow-hidden rounded-[22px]">
      <div data-tour="focus" className="flow-inverse px-5 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{active ? "กำลังโฟกัส" : "งานตอนนี้"}</p>
        <h2 className="mt-2 break-words text-xl font-bold">{activeTaskMissing ? "งานนี้ไม่พร้อมใช้งานแล้ว" : selectedTask?.title ?? "พักก่อน"}</h2>
        {activeTaskMissing && <p className="mt-2 text-sm text-[var(--flow-lime)]">Focus Session ยังบันทึกได้ แต่งานต้นทางถูกลบหรือไม่อยู่ในวันนี้แล้ว</p>}
        {!active && <p className="mt-2 text-sm text-[var(--flow-lime)]">{context.reason}</p>}
        {context.nextTask && <p className="mt-1 text-xs opacity-75">งานถัดไป: {context.nextTask.title}{context.nextTask.fixedTime ? ` · ${context.nextTask.fixedTime}` : ""}{context.nextTask.travelFromPrevMin ? ` · เดินทาง ${context.nextTask.travelFromPrevMin} นาที` : ""}{context.nextTask.lockTime ? " · ล็อกเวลา" : ""}</p>}
        <p className="font-grotesk my-4 text-6xl font-bold tabular-nums tracking-[-0.05em]" aria-label={`เวลาเหลือ ${minutes} นาที ${seconds} วินาที`}>{display}</p>
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-[var(--flow-lime)]">
          {active ? (active.pausedAt ? "พักอยู่ · พร้อมแล้วกดทำต่อ" : `เหลือเวลาตามแผน ${context.remainingTaskMin ?? "ยังไม่ประเมิน"} นาที`) : `พร้อมเริ่มด้วย ${plannedMin} นาที`}
        </p>
      </div>

      <div className="flow-form p-5">
        {!active && (
          <>
            <button type="button" disabled={!hasSafeWindow} className="flow-press flow-inverse flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl font-semibold disabled:cursor-not-allowed disabled:opacity-45" onClick={start}>
              <Play size={18} aria-hidden />เริ่มโฟกัส
            </button>
            {!hasSafeWindow && <p className="mt-2 text-center text-xs leading-5 text-[var(--flow-warning)]">{context.reason}</p>}
            <button type="button" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((value) => !value)} className="mt-2 flex min-h-11 w-full items-center justify-between rounded-xl px-2 text-sm font-semibold">
              ตัวเลือกระยะเวลา <ChevronDown aria-hidden size={16} className={optionsOpen ? "rotate-180" : ""} />
            </button>
            {optionsOpen && <div className="flow-expand grid grid-cols-2 gap-2">
              {([
                ["pomodoro", "25 นาที"],
                ["long", "50 นาที"],
                ["remaining_task_time", `ตามงาน · ${context.recommendedMin} นาที`],
                ["custom", "กำหนดเอง"],
              ] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`min-h-11 rounded-xl border px-2 text-xs font-semibold ${mode === value ? "flow-inverse border-[var(--flow-ink)]" : "border-[var(--flow-line)]"}`}>{label}</button>)}
              {mode === "custom" && <label className="col-span-2 text-sm font-semibold">นาที<input aria-label="ระยะเวลา Focus แบบกำหนดเอง" type="number" min={1} max={240} value={customMin} onChange={(event) => setCustomMin(Number(event.target.value))} className="font-grotesk mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3" /></label>}
            </div>}
            <button type="button" aria-expanded={taskPickerOpen} onClick={() => setTaskPickerOpen((value) => !value)} className="mt-1 flex min-h-11 w-full items-center justify-center text-sm font-semibold underline decoration-[var(--flow-lime-dark)] decoration-2 underline-offset-4">เปลี่ยนงาน</button>
            {taskPickerOpen && <div className="flow-expand mt-2 space-y-1" role="listbox" aria-label="เลือกงานสำหรับ Focus">{tasks.filter((task) => !task.done).map((task) => <button type="button" role="option" aria-selected={selectedTask?.id === task.id} key={task.id} onClick={() => { setTaskId(task.id); setTaskPickerOpen(false); }} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-[var(--flow-line)] px-3 text-left text-sm"><span>{task.title}</span>{selectedTask?.id === task.id && <Check aria-hidden size={15} />}</button>)}</div>}
          </>
        )}

        {active && !showOutcome && !reschedulePreview && <div className="grid grid-cols-[3.5rem_1fr_3.5rem] gap-2">
          <button type="button" className="flow-press grid h-14 w-14 place-items-center rounded-2xl border-[1.5px] border-[var(--flow-line)]" aria-label={active.pausedAt ? "ทำต่อ" : "พัก"} onClick={pause}>{active.pausedAt ? <Play aria-hidden /> : <Pause aria-hidden />}</button>
          <button type="button" className="flow-press flow-inverse flex h-14 items-center justify-center gap-2 rounded-2xl font-semibold" onClick={() => setOutcomeOpen(true)}><Square size={17} aria-hidden />จบก่อนเวลา</button>
          <button type="button" disabled={!extension.allowed} title={extension.reason} aria-label={extension.allowed ? "เพิ่มเวลา Focus 5 นาที" : extension.reason} onClick={() => active && onActiveChange({ ...active, plannedMin: active.plannedMin + 5 })} className="flow-press grid h-14 w-14 place-items-center rounded-2xl border border-[var(--flow-line)] text-xs font-bold disabled:opacity-35">+5</button>
          {!extension.allowed && extension.reason && <p className="col-span-3 text-xs leading-5 text-[var(--flow-warning)]">{extension.reason}</p>}
        </div>}

        {showOutcome && active && <div className="flow-expand space-y-2" role="group" aria-label="เลือกผลลัพธ์ Focus">
          <p className="text-center text-sm font-semibold">จัดการงานหลัง Focus</p>
          {!active.taskId && <button type="button" onClick={() => saveOutcome("paused")} className="flow-press flow-inverse min-h-12 w-full rounded-xl font-semibold">พักเสร็จแล้ว · กลับไปดูงาน</button>}
          {activeTaskMissing && <button type="button" onClick={() => saveOutcome("abandoned")} className="flow-press flow-inverse min-h-12 w-full rounded-xl font-semibold">จบและเก็บ Session นี้</button>}
          {active.taskId && !activeTaskMissing && <button type="button" onClick={() => saveOutcome("completed")} className="flow-press flow-inverse min-h-12 w-full rounded-xl font-semibold">งานเสร็จแล้ว</button>}
          {active.taskId && !activeTaskMissing && <button type="button" disabled={context.recommendedMin <= 0} onClick={continueFocus} className="flow-press min-h-12 w-full rounded-xl border border-[var(--flow-line)] font-semibold disabled:cursor-not-allowed disabled:opacity-45">ทำต่อ</button>}
          {active.taskId && !activeTaskMissing && <button type="button" disabled={Boolean(selectedTask?.lockTime)} onClick={openReschedulePreview} className="flow-press min-h-12 w-full rounded-xl border border-[var(--flow-line)] font-semibold disabled:cursor-not-allowed disabled:opacity-45">ยังไม่เสร็จ · จัดเวลาใหม่</button>}
          {selectedTask?.lockTime && <p className="text-xs leading-5 text-[var(--flow-muted)]">งานนี้ล็อกเวลาไว้ Flow จะไม่ย้ายเวลา หากต้องการเปลี่ยนให้แก้การล็อกในรายละเอียดงานก่อน</p>}
          {active.taskId && !activeTaskMissing && <button type="button" onClick={startBreak} className="flow-press min-h-12 w-full rounded-xl border border-[var(--flow-line)] font-semibold">พักก่อน 5 นาที</button>}
          <button type="button" onClick={() => setOutcomeOpen(false)} className="min-h-11 w-full text-sm underline">กลับไป Focus</button>
        </div>}

        {reschedulePreview && <div className="flow-expand rounded-xl border-[1.5px] border-[var(--flow-ink)] p-3">
          <p className="font-semibold">ตรวจสอบก่อนจัดเวลาใหม่</p>
          <p className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">งานยังเหลือประมาณ {reschedulePreview.remainingMin} นาที ระบบจะนำเวลาเดิมออกหลังคุณยืนยัน แล้วเปิด Planner ให้ตรวจแผนอีกครั้ง งานล็อกเวลาอื่นจะไม่ถูกย้าย</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setReschedulePreview(null); setOutcomeOpen(true); }} className="min-h-11 rounded-xl border border-[var(--flow-line)] font-semibold">ย้อนกลับ</button>
            <button type="button" onClick={confirmReschedule} className="flow-inverse min-h-11 rounded-xl font-semibold"><RotateCcw aria-hidden size={15} className="mr-1 inline" />ยืนยัน</button>
          </div>
        </div>}

        <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
        <p className="mt-4 text-xs text-[var(--flow-muted)]">บันทึกแล้ว <span className="font-grotesk">{sessions.length}</span> เซสชัน · ใช้ timestamp จริงและทำต่อหลัง Refresh ได้</p>
      </div>
    </section>
  );
}
