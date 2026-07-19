"use client";

import { Check, Clock3, MapPin, Plus, X } from "lucide-react";
import type { Category, Task } from "@/lib/types";

const PRIORITY = {
  urgent: { label: "ด่วน", rail: "bg-[#111111]", badge: "bg-[#111111] text-[var(--flow-lime)]" },
  high: { label: "สำคัญ", rail: "bg-[var(--flow-lime-dark)]", badge: "border border-[var(--flow-lime-dark)]" },
  normal: { label: "ปกติ", rail: "bg-[var(--flow-line)] opacity-35", badge: "border flow-hairline" },
  flex: { label: "ยืดหยุ่น", rail: "border border-dashed border-[var(--flow-line)]", badge: "border border-dashed flow-hairline" },
} as const;

export function TaskListView({ tasks, categories, onToggle, onDelete, onAdd }: {
  tasks: Task[];
  categories: Category[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  if (!tasks.length) {
    return (
      <section className="flow-view flow-surface rounded-[22px] border border-dashed border-[var(--flow-line)] px-6 py-9 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--flow-lime)] text-[#111111]"><Plus size={20} aria-hidden /></span>
        <h2 className="mt-4 font-bold">วันนี้ยังมีพื้นที่ให้คุณ</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">เริ่มจากงานหนึ่งอย่าง แล้วค่อยจัดจังหวะที่เหลือ</p>
        <button type="button" onClick={onAdd} className="flow-press mt-4 min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] px-4 text-sm font-semibold">เพิ่มงานแรก</button>
      </section>
    );
  }

  return (
    <div className="flow-stagger space-y-2.5">
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
                  <span className="flex items-center gap-1"><Clock3 size={13} aria-hidden /><span className="font-grotesk">{task.allDay ? "ALL DAY" : task.fixedTime ?? "UNSCHEDULED"}</span></span>
                  {task.place && <span className="flex min-w-0 items-center gap-1"><MapPin size={13} aria-hidden /><span className="truncate">{task.place}</span></span>}
                  {task.categoryId && names.get(task.categoryId) && <span>{names.get(task.categoryId)}</span>}
                </div>
                {task.deadlineDate && <p className="mt-2 text-xs text-[var(--flow-warning)]">เส้นตาย <span className="font-grotesk">{task.deadlineDate} {task.deadlineTime}</span></p>}
              </div>
              <button aria-label={`ลบ ${task.title}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--flow-muted)] hover:bg-[var(--flow-surface)] hover:text-[var(--flow-ink)]" onClick={() => onDelete(task.id)}><X size={17} /></button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
