"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Clock3, GripHorizontal, GripVertical, Route, Trash2 } from "lucide-react";
import type { Category, Task } from "@/lib/types";
import { endTime, localDateKey, localTimeKey, minutesToTime, snapMinutes, timeToMinutes } from "@/lib/time";

const PRIORITY_LABEL = { urgent: "ด่วน", high: "สำคัญ", normal: "ปกติ", flex: "ยืดหยุ่น" } as const;

type DragState = {
  id: string;
  mode: "move" | "resize";
  pointerId: number;
  startY: number;
  originMin: number;
  originDuration: number;
  previewMin: number;
  previewDuration: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function DayTimeline({ date, tasks, categories, startHour, endHour, onChange, onDelete, onToggle }: {
  date: string;
  tasks: Task[];
  categories: Category[];
  startHour: number;
  endHour: number;
  onChange: (task: Task) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const board = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);
  const scheduled = useMemo(() => tasks.filter((task) => task.fixedTime && !task.allDay).sort((a, b) => (a.fixedTime ?? "").localeCompare(b.fixedTime ?? "")), [tasks]);
  const allDay = tasks.filter((task) => task.allDay);
  const unscheduled = tasks.filter((task) => !task.fixedTime && !task.allDay);
  const totalMinutes = Math.max(60, (endHour - startHour) * 60);
  const boardHeight = Math.max(640, (endHour - startHour) * 68);
  const collisions = new Set<string>();

  scheduled.forEach((task, index) => {
    const next = scheduled[index + 1];
    if (next && task.durationMin != null && timeToMinutes(task.fixedTime ?? "00:00") + task.durationMin > timeToMinutes(next.fixedTime ?? "00:00")) {
      collisions.add(task.id);
      collisions.add(next.id);
    }
  });

  const commitKeyboard = (task: Task, start: number, duration: number | undefined) => {
    const fixedTime = minutesToTime(start);
    onChange({ ...task, fixedTime, durationMin: duration, updatedAt: new Date().toISOString() });
    setAnnouncement(duration == null
      ? `${task.title} ย้ายไปเวลา ${fixedTime} ระยะเวลายังรอ AI ประเมิน`
      : `${task.title} ย้ายไปเวลา ${fixedTime} ถึง ${endTime(fixedTime, duration)}`);
  };

  const beginDrag = (event: React.PointerEvent<HTMLElement>, task: Task, mode: DragState["mode"]) => {
    if (!board.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const originMin = timeToMinutes(task.fixedTime ?? `${String(startHour).padStart(2, "0")}:00`);
    const originDuration = task.durationMin ?? 60;
    setDrag({ id: task.id, mode, pointerId: event.pointerId, startY: event.clientY, originMin, originDuration, previewMin: originMin, previewDuration: originDuration });
  };

  const updateDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag || !board.current || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const rect = board.current.getBoundingClientRect();
    const delta = snapMinutes(((event.clientY - drag.startY) / rect.height) * totalMinutes);
    if (event.clientY < 84) window.scrollBy({ top: -20, behavior: "auto" });
    if (event.clientY > window.innerHeight - 84) window.scrollBy({ top: 20, behavior: "auto" });
    setDrag((current) => {
      if (!current) return null;
      if (current.mode === "resize") {
        const maxDuration = endHour * 60 - current.originMin;
        return { ...current, previewDuration: clamp(snapMinutes(current.originDuration + delta), 15, maxDuration) };
      }
      const latest = clamp(snapMinutes(current.originMin + delta), startHour * 60, endHour * 60 - current.originDuration);
      return { ...current, previewMin: latest };
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>, task: Task) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    const fixedTime = minutesToTime(drag.previewMin);
    const durationMin = drag.mode === "resize" ? drag.previewDuration : task.durationMin;
    onChange({ ...task, fixedTime, durationMin, updatedAt: new Date().toISOString() });
    setAnnouncement(durationMin == null
      ? `${task.title} อยู่เวลา ${fixedTime} ระยะเวลายังรอ AI ประเมิน`
      : `${task.title} อยู่เวลา ${fixedTime} ถึง ${endTime(fixedTime, durationMin)}`);
    setDrag(null);
  };

  const cancelDrag = () => setDrag(null);

  const compactCard = (task: Task) => (
    <article key={task.id} className={`flow-card rounded-2xl p-3 ${task.done ? "opacity-55" : ""} ${collisions.has(task.id) ? "border-amber-600" : ""}`}>
      <div className="flex items-start gap-2">
        <button className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--flow-line)] ${task.done ? "bg-[var(--flow-ink)] text-[var(--flow-paper)]" : ""}`} onClick={() => onToggle(task.id)} aria-label={task.done ? `ทำ ${task.title} ให้ยังไม่เสร็จ` : `ทำ ${task.title} ให้เสร็จ`}>{task.done && <Check size={18} />}</button>
        <div className="min-w-0 flex-1 py-1"><h3 className={`font-semibold ${task.done ? "line-through" : ""}`}>{task.title}</h3><p className="mt-1 text-xs text-[var(--flow-muted)]">{PRIORITY_LABEL[task.priority]}{task.categoryId && categoryNames.get(task.categoryId) ? ` · ${categoryNames.get(task.categoryId)}` : ""}{task.place ? ` · ${task.place}` : ""}</p>{collisions.has(task.id) && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[var(--flow-warning)]"><AlertTriangle size={14} aria-hidden />เวลาชนกับงานอื่น ระบบจะไม่ย้ายให้เอง</p>}</div>
        <button aria-label={`ลบ ${task.title}`} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-muted)] hover:bg-[var(--flow-surface)]" onClick={() => onDelete(task.id)}><Trash2 size={17} /></button>
      </div>
    </article>
  );

  const currentMinutes = timeToMinutes(localTimeKey());
  const showNow = date === localDateKey() && currentMinutes >= startHour * 60 && currentMinutes <= endHour * 60;

  return (
    <div className="space-y-5">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      {allDay.length > 0 && <section aria-labelledby="all-day-heading"><div className="mb-2 flex items-center justify-between"><h2 id="all-day-heading" className="text-sm font-bold">ทั้งวัน</h2><span className="font-grotesk text-[10px] text-[var(--flow-muted)]">{allDay.length} ITEMS</span></div><div className="flow-stagger space-y-2">{allDay.map(compactCard)}</div></section>}

      <section aria-labelledby="timeline-heading">
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs text-[var(--flow-muted)]">ลากเพื่อย้าย · จับขอบล่างเพื่อย่อขยาย</p><h2 id="timeline-heading" className="mt-0.5 text-lg font-bold">ไทม์ไลน์ของวัน</h2></div><span className="font-grotesk rounded-full border flow-hairline px-2.5 py-1 text-[10px]">{String(startHour).padStart(2, "0")}:00–{String(endHour).padStart(2, "0")}:00</span></div>
        <div ref={board} className="flow-surface relative overflow-hidden rounded-[22px] border-[1.5px] border-[var(--flow-line)] shadow-[var(--flow-shadow-small)]" style={{ height: boardHeight }}>
          {Array.from({ length: endHour - startHour + 1 }, (_, index) => <div key={index} className="pointer-events-none absolute inset-x-0 border-t flow-hairline" style={{ top: `${(index * 60 / totalMinutes) * 100}%` }}><span className="font-grotesk absolute left-2 top-1 rounded bg-[var(--flow-surface)] px-1 text-[10px] text-[var(--flow-muted)]">{String(startHour + index).padStart(2, "0")}:00</span></div>)}
          {showNow && <div className="pointer-events-none absolute inset-x-10 z-20 flex items-center" style={{ top: `${((currentMinutes - startHour * 60) / totalMinutes) * 100}%` }}><span className="h-2.5 w-2.5 rounded-full bg-[var(--flow-lime-dark)] ring-2 ring-[var(--flow-paper)]"/><span className="h-0.5 flex-1 bg-[var(--flow-lime-dark)]"/><span className="font-grotesk ml-1 rounded bg-[var(--flow-lime)] px-1.5 py-0.5 text-[9px] font-bold text-[#111111]">NOW</span></div>}
          {scheduled.map((task) => {
            const activeDrag = drag?.id === task.id ? drag : null;
            const isDragging = activeDrag !== null;
            const awaitingDuration = task.durationMin == null && drag?.mode !== "resize";
            const start = activeDrag?.previewMin ?? timeToMinutes(task.fixedTime ?? "00:00");
            const duration = activeDrag?.previewDuration ?? task.durationMin ?? 60;
            const top = clamp(((start - startHour * 60) / totalMinutes) * 100, 0, 100);
            const height = Math.max(48, (duration / totalMinutes) * boardHeight);
            const originalTop = clamp(((timeToMinutes(task.fixedTime ?? "00:00") - startHour * 60) / totalMinutes) * 100, 0, 100);
            const originalHeight = Math.max(48, ((task.durationMin ?? 60) / totalMinutes) * boardHeight);
            return (
              <div key={task.id}>
                {isDragging && <div aria-hidden className="absolute left-12 right-2 rounded-xl border-[1.5px] border-dashed border-[var(--flow-line)] opacity-35" style={{ top: `${originalTop}%`, height: originalHeight }} />}
                <article className={`absolute left-12 right-2 z-10 overflow-hidden rounded-xl border-[1.5px] bg-[var(--flow-paper)] shadow-[var(--flow-shadow-small)] transition-[top,height,box-shadow,opacity] duration-150 ${collisions.has(task.id) ? "border-amber-600" : "border-[var(--flow-line)]"} ${isDragging ? "z-30 opacity-90 shadow-[var(--flow-shadow)]" : ""}`} style={{ top: `${top}%`, height }}>
                  <button type="button" onPointerDown={(event) => beginDrag(event, task, "move")} onPointerMove={updateDrag} onPointerUp={(event) => finishDrag(event, task)} onPointerCancel={cancelDrag} onKeyDown={(event) => {
                    const startMin = timeToMinutes(task.fixedTime ?? "00:00");
                    if (event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) { event.preventDefault(); commitKeyboard(task, startMin, Math.max(15, (task.durationMin ?? 60) + (event.key === "ArrowUp" ? -15 : 15))); return; }
                    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); commitKeyboard(task, clamp(startMin + (event.key === "ArrowUp" ? -15 : 15), startHour * 60, endHour * 60 - (task.durationMin ?? 60)), task.durationMin); }
                  }} className="touch-none flex h-full w-full items-start gap-1.5 overflow-hidden px-2 py-2 pr-12 text-left focus-visible:z-20" aria-label={`${task.title} เวลา ${minutesToTime(start)}${awaitingDuration ? " ระยะเวลารอ AI ประเมิน" : ` ถึง ${endTime(minutesToTime(start), duration)}`} ใช้ลูกศรขึ้นลงเพื่อย้าย 15 นาที หรือ Shift พร้อมลูกศรเพื่อปรับระยะเวลา`}>
                    <GripVertical size={14} className="mt-0.5 shrink-0 text-[var(--flow-muted)]" aria-hidden />
                    <span className="min-w-0"><span className="block truncate text-sm font-semibold">{task.aiAdded && <Route size={13} className="mr-1 inline text-[var(--flow-lime-dark)]" aria-label="Travel block ที่ AI เพิ่ม"/>}{task.title}</span><span className="font-grotesk block text-[10px] text-[var(--flow-muted)]">{awaitingDuration ? `${minutesToTime(start)} · รอ AI ประเมินระยะเวลา` : `${minutesToTime(start)}–${endTime(minutesToTime(start), duration)} · ${duration}m`}</span>{collisions.has(task.id) && <span className="mt-0.5 flex items-center gap-1 text-[9px] font-semibold text-[var(--flow-warning)]"><AlertTriangle size={10} aria-hidden />เวลาชน</span>}</span>
                  </button>
                  <button type="button" onPointerDown={(event) => beginDrag(event, task, "resize")} onPointerMove={updateDrag} onPointerUp={(event) => finishDrag(event, task)} onPointerCancel={cancelDrag} onKeyDown={(event)=>{if(event.key!=="ArrowUp"&&event.key!=="ArrowDown")return;event.preventDefault();const nextDuration=Math.max(15,(task.durationMin??60)+(event.key==="ArrowUp"?-15:15));commitKeyboard(task,timeToMinutes(task.fixedTime??"00:00"),nextDuration);}} onClick={(event)=>{if(event.detail===0)commitKeyboard(task,timeToMinutes(task.fixedTime??"00:00"),(task.durationMin??60)+15);}} className="touch-none absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-tl-xl border-l border-t flow-hairline bg-[var(--flow-surface)]" aria-label={`ปรับระยะเวลา ${task.title} ใช้ลูกศรขึ้นลง หรือกดเพื่อเพิ่ม 15 นาที`}><GripHorizontal size={16} aria-hidden /></button>
                </article>
              </div>
            );
          })}
          {!scheduled.length && <div className="absolute inset-0 grid place-items-center p-8 text-center"><div><Clock3 className="mx-auto text-[var(--flow-muted)]" aria-hidden/><p className="mt-3 text-sm font-semibold">ยังไม่มีงานบน Timeline</p><p className="mt-1 text-xs text-[var(--flow-muted)]">กำหนดเวลาให้กับงานด้านล่าง แล้วงานจะปรากฏตรงนี้</p></div></div>}
        </div>
      </section>

      {unscheduled.length > 0 && <section aria-labelledby="unscheduled-heading"><div className="mb-2 flex items-center justify-between"><h2 id="unscheduled-heading" className="font-bold">ยังไม่ได้จัดเวลา</h2><span className="font-grotesk text-[10px] text-[var(--flow-muted)]">{unscheduled.length} ITEMS</span></div><div className="flow-stagger space-y-2">{unscheduled.map(compactCard)}</div></section>}
    </div>
  );
}
