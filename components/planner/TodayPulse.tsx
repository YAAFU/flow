"use client";

import { ArrowRight, CheckCircle2, Clock3, Coffee, Play } from "lucide-react";
import { endTime, localDateKey, localTimeKey, timeToMinutes } from "@/lib/time";
import type { Task } from "@/lib/types";

function Remaining({ minutes }: { minutes: number }) {
  if (minutes <= 0) return <>ตอนนี้</>;
  if (minutes < 60) return <><span className="font-grotesk">{minutes}</span> นาที</>;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return <><span className="font-grotesk">{hours}</span> ชม.{rest ? <> <span className="font-grotesk">{rest}</span> นาที</> : null}</>;
}

export function TodayPulse({ date, tasks, startHour, endHour, primaryLabel = "เริ่มงานถัดไป", primaryIcon = "play", onOpenTimeline, onStartFocus }: {
  date: string;
  tasks: Task[];
  startHour: number;
  endHour: number;
  primaryLabel?: string;
  primaryIcon?: "play" | "timeline";
  onOpenTimeline: () => void;
  onStartFocus: () => void;
}) {
  const now = new Date();
  const isToday = date === localDateKey(now);
  const nowMin = timeToMinutes(localTimeKey(now));
  const scheduled = tasks
    .filter((task) => task.fixedTime && !task.allDay && !task.done)
    .sort((a, b) => (a.fixedTime ?? "").localeCompare(b.fixedTime ?? ""));
  const current = isToday
    ? scheduled.find((task) => {
        const start = timeToMinutes(task.fixedTime ?? "00:00");
        return task.durationMin != null && start <= nowMin && start + task.durationMin > nowMin;
      })
    : undefined;
  const next = scheduled.find((task) => !isToday || timeToMinutes(task.fixedTime ?? "00:00") > nowMin);
  const usedFuture = scheduled.reduce((sum, task) => {
    if (task.durationMin == null) return sum;
    const start = timeToMinutes(task.fixedTime ?? "00:00");
    const end = start + task.durationMin;
    const from = isToday ? Math.max(start, nowMin, startHour * 60) : Math.max(start, startHour * 60);
    return sum + Math.max(0, Math.min(end, endHour * 60) - from);
  }, 0);
  const windowStart = isToday ? Math.max(nowMin, startHour * 60) : startHour * 60;
  const freeMinutes = Math.max(0, endHour * 60 - windowStart - usedFuture);
  const awaitingDuration = scheduled.some((task) => task.durationMin == null);
  const untilNext = next && isToday ? timeToMinutes(next.fixedTime ?? "00:00") - nowMin : null;
  const planHasEnded = scheduled.length > 0 && !current && !next;

  return (
    <section data-tour="today-pulse" aria-labelledby="today-pulse-heading" className="flow-inverse flow-sheet overflow-hidden rounded-[22px] border-[1.5px] border-[#111111] shadow-[var(--flow-shadow)]">
      <div className="flex items-center justify-between border-b border-current/15 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--flow-lime)]" aria-hidden="true" />
          <h2 id="today-pulse-heading" className="text-sm font-bold">ภาพรวมจังหวะวันนี้</h2>
        </div>
        <span className="font-grotesk text-[10px] font-bold tracking-[0.16em] opacity-60">NOW / NEXT</span>
      </div>

      <div className="px-5 py-5">
        <div className="min-w-0">
          <p className="text-xs opacity-60">{current ? "กำลังทำ" : isToday ? "ตอนนี้" : "งานแรกของวัน"}</p>
          <p className="mt-1 truncate text-xl font-bold leading-tight">{current?.title ?? next?.title ?? (planHasEnded ? "ไม่มีงานตามแผนที่เหลือ" : "ยังไม่มีงานที่กำหนดเวลา")}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs opacity-70">
            <Clock3 size={14} aria-hidden />
            {current?.fixedTime && current.durationMin != null ? <span className="font-grotesk">{current.fixedTime}–{endTime(current.fixedTime, current.durationMin)}</span> : next?.fixedTime ? <>เริ่ม <span className="font-grotesk">{next.fixedTime}</span>{next.durationMin == null ? " · รอ Flow ประเมินระยะเวลา" : null}</> : planHasEnded ? "เปิด Timeline เพื่อทบทวนหรือปรับแผน" : "เพิ่มงานเมื่อพร้อม"}
          </p>
        </div>
        <button
          data-tour="primary-action"
          type="button"
          onClick={onStartFocus}
          className="flow-press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--flow-lime)] px-4 font-semibold text-[#111111]"
        >
          {primaryIcon === "play" ? <Play size={18} fill="currentColor" aria-hidden /> : <Clock3 size={18} aria-hidden />}
          {primaryLabel}
        </button>
      </div>

      <div className="grid grid-cols-2 border-t border-current/15">
        <div className="border-r border-current/15 px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs opacity-60"><ArrowRight size={14} aria-hidden />งานถัดไป</p>
          <p className="mt-1 truncate text-sm font-semibold">{current ? next?.title ?? "ไม่มีงานต่อ" : next?.title ?? (planHasEnded ? "จบตามแผนแล้ว" : "ยังไม่กำหนด")}</p>
          {untilNext !== null && <p className="mt-1 text-xs text-[var(--flow-lime)]">อีก <Remaining minutes={untilNext} /></p>}
        </div>
        <div className="px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs opacity-60"><Coffee size={14} aria-hidden />เวลาว่างที่เหลือ</p>
          <p className="mt-1 text-xl font-bold text-[var(--flow-lime)]"><Remaining minutes={freeMinutes} /></p>
          <p className="mt-1 text-[10px] opacity-55">ถึง <span className="font-grotesk">{String(endHour).padStart(2, "0")}:00</span></p>
          {awaitingDuration && <p className="mt-1 text-[10px] opacity-55">ไม่รวมงานที่รอ AI ประเมินระยะเวลา</p>}
        </div>
      </div>

      <button type="button" onClick={onOpenTimeline} className="flow-press flex min-h-12 w-full items-center justify-center gap-2 border-t border-current/15 text-sm font-semibold">
        <CheckCircle2 size={16} className="text-[var(--flow-lime)]" aria-hidden />ดูความเป็นไปได้บน Timeline
      </button>
    </section>
  );
}
