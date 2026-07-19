"use client";
import { X, AlertCircle, Check, MapPin } from "lucide-react";
import type { Task, AutoMode } from "@/lib/types";

const PRIO: Record<Task["priority"], { label: string; cls: string }> = {
  urgent: { label: "ด่วน", cls: "border-[#111] bg-[#111] text-[#D6FF3F] font-semibold" },
  high: { label: "สำคัญมาก", cls: "border-[var(--flow-lime)] bg-[var(--flow-lime)] font-semibold" },
  normal: { label: "ปกติ", cls: "border-neutral-300 text-neutral-500" },
  flex: { label: "ยืดได้", cls: "border-neutral-200 text-neutral-400" },
};
const fmtDur = (min: number) => { const h = Math.floor(min / 60), m = min % 60; return [h ? `${h}ชม` : "", m ? `${m}น` : ""].filter(Boolean).join(" ") || "0น"; };

export function TaskList({ tasks, onRemove, onEdit, editingId, onToggleDone, onCheckin, autoMode = "manual", schedule }:
  { tasks: Task[]; onRemove: (id: string) => void; onEdit?: (id: string) => void; editingId?: string | null;
    onToggleDone?: (id: string) => void; onCheckin?: (id: string) => void; autoMode?: AutoMode;
    schedule?: Record<string, { start: string; end: string; travel: number }> }) {
  const locAuto = autoMode === "location" || autoMode === "both";
  return (
    <div className="flex flex-col gap-2">
      {tasks.map((t, i) => {
        const prio = PRIO[t.priority];
        const sch = schedule?.[t.id];
        const time = sch?.start ?? t.fixedTime ?? t.deadline ?? "-";
        const done = !!t.done;
        return (
          <div key={t.id} className="flow-rise flex flex-col" style={{ animationDelay: `${Math.min(i, 6) * 60}ms` }}>
            {sch && i > 0 && sch.travel > 0 && (
              <div className="flex items-center gap-1.5 py-1 pl-3.5 text-[11px] text-neutral-400">
                <span className="inline-block h-3.5 w-0.5 bg-[repeating-linear-gradient(#ccc_0_3px,transparent_3px_6px)]" />
                เดินทาง ~<span className="font-grotesk">{sch.travel}</span> นาที
              </div>
            )}
            <div className={`flex items-stretch gap-2 rounded-2xl border-[1.5px] ${editingId === t.id ? "border-[var(--flow-lime)] bg-[#fbffe9]" : t.needsReview ? "border-amber-400 bg-amber-50" : done ? "border-neutral-200 bg-neutral-50" : "border-[var(--flow-ink)]"}`}>
              {/* checkbox */}
              <button aria-label="เช็คเสร็จ" onClick={() => onToggleDone?.(t.id)}
                className="flow-press flex items-center pl-3">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full border-[1.5px] transition-colors ${done ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-[var(--flow-lime)]" : "border-neutral-300"}`}>
                  {done && <Check size={15} strokeWidth={3} />}
                </span>
              </button>
              <div role="button" tabIndex={0} onClick={() => onEdit?.(t.id)} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1.5 py-3 pr-3.5 text-left">
                <div className="flex items-start gap-2">
                  <span className={`font-grotesk shrink-0 pt-px text-sm font-semibold ${done ? "text-neutral-400" : "text-[var(--flow-ink)]"}`}>{time}</span>
                  <span className={`min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-[15px] font-semibold leading-tight ${done ? "text-neutral-400 line-through" : ""}`}>{t.title}</span>
                  <span aria-label="remove" onClick={(e) => { e.stopPropagation(); onRemove(t.id); }}
                    className="shrink-0 text-[var(--flow-muted)] hover:text-[var(--flow-ink)]"><X size={16} /></span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                  <span className="truncate">{t.place}</span>
                  <span className="text-neutral-300">·</span>
                  <span className={t.durationMin == null ? "" : "font-grotesk"}>{t.durationMin == null ? "AI จัดเวลา" : fmtDur(t.durationMin)}</span>
                  {t.lockTime && t.fixedTime && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold text-neutral-500">ล็อกเวลา</span>}
                  {t.aiAdded && <span className="rounded-full bg-[#eaf4fe] px-1.5 py-0.5 text-[9px] font-semibold text-sky-600">เติมโดย AI</span>}
                  <span className={`ml-0.5 rounded-full border px-2 py-0.5 text-[10px] ${prio.cls}`}>{prio.label}</span>
                </div>
                {t.needsReview && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
                    <AlertCircle size={12} /> ต้องเช็ก: {t.note || "ข้อมูลไม่ครบ"} แตะเพื่อแก้
                  </span>
                )}
                {locAuto && !done && onCheckin && (
                  <button onClick={(e) => { e.stopPropagation(); onCheckin(t.id); }}
                    className="flow-press mt-0.5 flex w-fit items-center gap-1 rounded-full border border-[var(--flow-ink)] px-2.5 py-1 text-[11px] font-semibold">
                    <MapPin size={12} /> เช็คอินถึงที่ (จำลอง)
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
