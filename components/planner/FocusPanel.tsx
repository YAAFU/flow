"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import type { ActiveFocusSession, FocusMode, FocusSession, Task } from "@/lib/types";

type FocusPanelProps = {
  tasks: Task[];
  sessions: FocusSession[];
  active?: ActiveFocusSession;
  onActiveChange: (active?: ActiveFocusSession) => void;
  onComplete: (session: FocusSession, updateTask: boolean) => void;
};

export function FocusPanel({ tasks, sessions, active, onActiveChange, onComplete }: FocusPanelProps) {
  const [mode, setMode] = useState<FocusMode>("pomodoro");
  const [taskId, setTaskId] = useState("");
  const [plannedMin, setPlannedMin] = useState(25);
  const [now, setNow] = useState(0);
  const [updateDuration, setUpdateDuration] = useState(false);

  useEffect(() => {
    if (!active || active.pausedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const elapsed = active
    ? Math.max(0, (active.pausedAt ? new Date(active.pausedAt).getTime() : now) - new Date(active.startedAt).getTime() - active.pausedMs)
    : 0;
  const remain = Math.max(0, (active?.plannedMin ?? plannedMin) * 60_000 - elapsed);
  const minutes = Math.floor(remain / 60_000);
  const seconds = Math.floor((remain % 60_000) / 1000);
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const start = () => {
    const stamp = new Date().toISOString();
    setNow(Date.now());
    onActiveChange({ id: crypto.randomUUID(), taskId: taskId || undefined, mode, startedAt: stamp, plannedMin, pausedMs: 0 });
  };

  const pause = () => {
    if (!active) return;
    if (active.pausedAt) {
      onActiveChange({ ...active, pausedMs: active.pausedMs + Date.now() - new Date(active.pausedAt).getTime(), pausedAt: undefined });
      setNow(Date.now());
    } else {
      onActiveChange({ ...active, pausedAt: new Date().toISOString() });
    }
  };

  const finish = () => {
    if (!active) return;
    const session: FocusSession = {
      id: active.id,
      taskId: active.taskId,
      mode: active.mode,
      startedAt: active.startedAt,
      endedAt: new Date().toISOString(),
      plannedMin: active.plannedMin,
      actualMin: Math.round(elapsed / 60_000),
      completed: true,
    };
    onComplete(session, updateDuration);
    onActiveChange(undefined);
  };

  return (
    <section className="flow-card flow-rise overflow-hidden rounded-[22px]">
      <div className="flow-inverse px-5 py-7 text-center">
        <p className="text-sm opacity-70">โหมดโฟกัส</p>
        <p className="font-grotesk my-3 text-6xl font-bold tabular-nums tracking-[-0.05em]" aria-label={`เวลาเหลือ ${minutes} นาที ${seconds} วินาที`}>
          {display}
        </p>
        <p role="status" aria-live="polite" className="min-h-5 text-xs text-[var(--flow-lime)]">
          {active ? (active.pausedAt ? "พักอยู่ · พร้อมแล้วกดทำต่อ" : "กำลังโฟกัส · สิ่งอื่นรอได้") : "เลือกงานหนึ่งอย่าง แล้วให้เวลากับมันเต็มที่"}
        </p>
      </div>

      <div className="flow-form p-5">
        {!active && (
          <div className="space-y-3 text-left">
            <label className="block text-sm font-semibold" htmlFor="focus-mode">
              รูปแบบ
              <select id="focus-mode" value={mode} onChange={(event) => { const next = event.target.value as FocusMode; setMode(next); setPlannedMin(next === "pomodoro" ? 25 : 60); }} className="mt-1 h-12 w-full rounded-xl border bg-[var(--flow-paper)] px-3">
                <option value="free">อิสระ</option>
                <option value="pomodoro">Pomodoro 25 นาที</option>
                <option value="custom">กำหนดเอง</option>
              </select>
            </label>
            <label className="block text-sm font-semibold" htmlFor="focus-task">
              งาน
              <select id="focus-task" value={taskId} onChange={(event) => setTaskId(event.target.value)} className="mt-1 h-12 w-full rounded-xl border bg-[var(--flow-paper)] px-3">
                <option value="">ไม่ผูกกับงาน</option>
                {tasks.filter((task) => !task.done).map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
              </select>
            </label>
            {mode !== "pomodoro" && (
              <label className="block text-sm font-semibold" htmlFor="focus-minutes">
                นาที
                <input id="focus-minutes" type="number" min="1" max="240" value={plannedMin} onChange={(event) => setPlannedMin(Number(event.target.value))} className="font-grotesk mt-1 h-12 w-full rounded-xl border bg-transparent px-3" />
              </label>
            )}
          </div>
        )}

        {active?.taskId && (
          <label className="mt-1 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={updateDuration} onChange={(event) => setUpdateDuration(event.target.checked)} />
            อัปเดตระยะเวลาจริงให้งานเมื่อจบ
          </label>
        )}

        <div className="mt-5 flex gap-2">
          {!active ? (
            <button type="button" className="flow-press flow-inverse flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold" onClick={start}>
              <Play size={18} aria-hidden />เริ่ม
            </button>
          ) : (
            <>
              <button type="button" className="flow-press grid h-14 w-14 place-items-center rounded-2xl border-[1.5px] border-[var(--flow-line)]" aria-label={active.pausedAt ? "ทำต่อ" : "พัก"} onClick={pause}>
                {active.pausedAt ? <Play aria-hidden /> : <Pause aria-hidden />}
              </button>
              <button type="button" className="flow-press flow-inverse flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl font-semibold" onClick={finish}>
                <Square size={17} aria-hidden />จบเซสชัน
              </button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-[var(--flow-muted)]">
          บันทึกแล้ว <span className="font-grotesk">{sessions.length}</span> เซสชัน · เซสชันที่กำลังทำเก็บในอุปกรณ์และทำต่อหลังเปิดหน้าใหม่ได้
        </p>
      </div>
    </section>
  );
}
