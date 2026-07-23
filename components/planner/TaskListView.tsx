"use client";

import { Check, Clock3, LockKeyhole, MapPin, Pencil, Plus, X } from "lucide-react";
import type { Category, Task } from "@/lib/types";

const PRIORITY = {
  urgent: { label: "ด่วน", rail: "bg-[#111111]", badge: "bg-[#111111] text-[var(--flow-lime)]" },
  high: { label: "สำคัญ", rail: "bg-[var(--flow-lime-dark)]", badge: "border border-[var(--flow-lime-dark)]" },
  normal: { label: "ปกติ", rail: "bg-[var(--flow-line)] opacity-35", badge: "border flow-hairline" },
  flex: { label: "ยืดหยุ่น", rail: "border border-dashed border-[var(--flow-line)]", badge: "border border-dashed flow-hairline" },
} as const;

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} นาที`;
  if (!rest) return `${hours} ชม.`;
  return `${hours} ชม. ${rest} นาที`;
}

export function TaskListView({ tasks, categories, onToggle, onEdit, onDelete, onAdd, onTryExample, onOpenGuide }: {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onTryExample: () => void;
  onOpenGuide: () => void;
}) {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  if (!tasks.length) {
    return (
      <section data-tour="task-list" className="flow-view flow-surface rounded-[22px] border border-dashed border-[var(--flow-line)] px-5 py-5 text-left">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--flow-lime)] text-[#111111]"><Plus size={19} aria-hidden /></span>
          <h2 className="text-lg font-bold leading-tight">เริ่มจากบอกสิ่งที่ต้องทำ</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--flow-muted)]">เพิ่มงาน 2–3 อย่าง แล้วให้ Flow ช่วยจัดเวลาและลำดับให้เหมาะกับวันของคุณ</p>
        <div className="mt-4 grid gap-2">
          <button data-tour="primary-action" type="button" onClick={onAdd} className="flow-press flow-inverse min-h-12 rounded-xl px-4 text-sm font-semibold">เพิ่มงานแรก</button>
          <div className="grid grid-cols-[1.35fr_.65fr] gap-2">
            <button type="button" onClick={onTryExample} className="flow-press min-h-12 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-lime)] px-2 text-sm font-semibold leading-5 text-[#111111]">ลองด้วยวันตัวอย่าง</button>
            <button type="button" onClick={onOpenGuide} className="flow-press min-h-12 rounded-xl border border-[var(--flow-line)] px-2 text-sm font-semibold text-[var(--flow-muted)] underline decoration-[var(--flow-lime-dark)] decoration-2 underline-offset-4">ดูวิธีใช้</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div data-tour="task-list" className="flow-stagger space-y-2.5">
      {[...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((task) => {
        const priority = PRIORITY[task.priority];
        return (
          <article key={task.id} className={`flow-card relative overflow-hidden rounded-2xl p-3.5 ${task.done ? "opacity-55" : ""}`}>
            <span aria-hidden="true" className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${priority.rail}`} />
            <div className="flex items-start gap-3">
              <button aria-label={task.done ? `ทำ ${task.title} ให้ยังไม่เสร็จ` : `ทำ ${task.title} ให้เสร็จ`} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[1.5px] border-[var(--flow-line)] ${task.done ? "bg-[var(--flow-ink)] text-[var(--flow-paper)]" : "bg-[var(--flow-paper)]"}`} onClick={() => onToggle(task.id)}>
                {task.done && <Check size={18} strokeWidth={2.5} />}
              </button>
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <h3 className={`min-w-0 text-[15px] font-semibold leading-5 ${task.done ? "line-through" : ""}`}>{task.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${priority.badge}`}>{priority.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--flow-muted)]">
                  <span className="flex items-center gap-1"><Clock3 size={13} aria-hidden /><span>{task.allDay ? "ทั้งวัน" : task.fixedTime ? <span className="font-grotesk">{task.fixedTime}</span> : "ให้ AI จัดเวลา"}</span></span>
                  <span>{task.durationMin != null ? formatDuration(task.durationMin) : "รอ AI ประเมิน"}</span>
                  {task.lockTime && <span className="flex items-center gap-1"><LockKeyhole size={12} aria-hidden />ล็อกเวลา</span>}
                  {task.place && <span className="flex min-w-0 items-center gap-1"><MapPin size={13} aria-hidden /><span className="truncate">{task.place}</span></span>}
                  {task.categoryId && names.get(task.categoryId) && <span>{names.get(task.categoryId)}</span>}
                </div>
                {task.deadlineDate && <p className="mt-2 text-xs text-[var(--flow-warning)]">เส้นตาย <span className="font-grotesk">{task.deadlineDate} {task.deadlineTime}</span></p>}
              </div>
              <div className="flex shrink-0 flex-col sm:flex-row">
                <button type="button" aria-label={`แก้ไข ${task.title}`} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-muted)] hover:bg-[var(--flow-surface)] hover:text-[var(--flow-ink)]" onClick={() => onEdit(task.id)}><Pencil size={16} /></button>
                <button type="button" aria-label={`ลบ ${task.title}`} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-muted)] hover:bg-[var(--flow-surface)] hover:text-[var(--flow-ink)]" onClick={() => onDelete(task.id)}><X size={17} /></button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
