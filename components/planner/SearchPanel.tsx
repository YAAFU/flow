"use client";

import { useDeferredValue, useState } from "react";
import { ArrowRight, CalendarDays, Search } from "lucide-react";
import type { Category, Task } from "@/lib/types";

export function SearchPanel({ tasksByDay, categories, onOpen }: {
  tasksByDay: Record<string, Task[]>;
  categories: Category[];
  onOpen: (date: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const deferredQuery = useDeferredValue(query);
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const normalized = deferredQuery.trim().toLocaleLowerCase("th");
  const groups = Object.entries(tasksByDay)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, tasks]) => ({
      date,
      tasks: tasks.filter((task) => {
        const matchesText = !normalized || [task.title, task.place, task.note, names.get(task.categoryId ?? "")].some((value) => value?.toLocaleLowerCase("th").includes(normalized));
        const matchesStatus = status === "all" || (status === "done" ? task.done : !task.done);
        return matchesText && matchesStatus;
      }),
    }))
    .filter((group) => group.tasks.length);

  return (
    <section className="flow-view" aria-labelledby="search-heading">
      <div className="flow-surface rounded-[22px] border border-[var(--flow-line)] p-3">
        <label className="relative block" htmlFor="flow-search">
          <Search aria-hidden className="absolute left-3.5 top-3.5 text-[var(--flow-muted)]" size={19} />
          <span className="sr-only">ค้นหางาน</span>
          <input id="flow-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ สถานที่ หมวดหมู่ หรือโน้ต" className="h-12 w-full rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] pl-10 pr-3" />
        </label>
        <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="กรองสถานะงาน">
          {[["all", "ทั้งหมด"], ["open", "ยังไม่เสร็จ"], ["done", "เสร็จแล้ว"]].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-11 rounded-xl px-2 text-xs font-semibold ${status === value ? "bg-[var(--flow-ink)] text-[var(--flow-paper)]" : "text-[var(--flow-muted)]"}`}>{label}</button>)}
        </div>
      </div>

      <p id="search-heading" className="mt-5 text-xs text-[var(--flow-muted)]" aria-live="polite">พบ <span className="font-grotesk">{groups.reduce((sum, group) => sum + group.tasks.length, 0)}</span> งาน</p>
      <div className="mt-3 space-y-6">
        {groups.map((group) => (
          <section key={group.date}>
            <button className="flow-press mb-2 flex min-h-11 w-full items-center justify-between rounded-xl text-left" onClick={() => onOpen(group.date)}>
              <span className="flex items-center gap-2 text-sm font-bold"><CalendarDays size={16} aria-hidden /><span className="font-grotesk">{group.date}</span></span><ArrowRight size={16} aria-hidden />
            </button>
            <div className="flow-stagger space-y-2">
              {group.tasks.map((task) => <article key={task.id} className="flow-card rounded-2xl p-3.5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{task.title}</p><p className="mt-1 truncate text-xs text-[var(--flow-muted)]">{task.done ? "เสร็จแล้ว" : "ยังไม่เสร็จ"}{task.place ? ` · ${task.place}` : ""}</p></div><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${task.done ? "bg-[var(--flow-lime-dark)]" : "border border-[var(--flow-line)]"}`}><span className="sr-only">{task.done ? "สถานะเสร็จแล้ว" : "สถานะยังไม่เสร็จ"}</span></span></div></article>)}
            </div>
          </section>
        ))}
        {!groups.length && <div className="flow-surface rounded-[22px] border border-dashed border-[var(--flow-line)] px-6 py-10 text-center"><Search className="mx-auto text-[var(--flow-muted)]" aria-hidden/><p className="mt-3 font-semibold">ยังไม่พบงานที่ตรงกัน</p><p className="mt-1 text-sm text-[var(--flow-muted)]">ลองใช้คำสั้นลงหรือเลือกสถานะอื่น</p></div>}
      </div>
    </section>
  );
}
