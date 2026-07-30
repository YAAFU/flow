"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import type { FlowState } from "@/lib/types";
import { calculateStatistics } from "@/lib/statistics";

type RangeDays = 1 | 7 | 30;

export function DashboardPanel({ state }: { state: FlowState }) {
  const [days, setDays] = useState<RangeDays>(7);
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days + 1);
  const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const stats = calculateStatistics(state.tasksByDay, key(from), key(to), to);

  const cards = [
    { label: "งานที่ทำสำเร็จ", value: stats.completed, suffix: `/ ${stats.total}`, icon: CheckCircle2 },
    { label: "เวลาตามแผน", value: stats.plannedMinutes, suffix: "นาที", icon: Clock3 },
    { label: "งานเลยกำหนด", value: stats.overdue, suffix: "งาน", icon: AlertTriangle, warning: stats.overdue > 0 },
  ];

  return (
    <section className="flow-view" aria-labelledby="dashboard-heading">
      <div className="flex items-end justify-between gap-3">
        <div><p className="text-xs text-[var(--flow-muted)]">ข้อมูลจริงจากอุปกรณ์นี้</p><h2 id="dashboard-heading" className="mt-1 text-xl font-bold">จังหวะการทำงาน</h2></div>
        <div className="flow-surface flex rounded-xl border flow-hairline p-1" role="group" aria-label="ช่วงเวลาสถิติ">
          {([1, 7, 30] as RangeDays[]).map((value) => <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)} className={`font-grotesk min-h-9 min-w-10 rounded-lg px-2 text-xs font-semibold ${days === value ? "bg-[var(--flow-ink)] text-[var(--flow-paper)]" : "text-[var(--flow-muted)]"}`}>{value}D</button>)}
        </div>
      </div>

      <article className="flow-inverse mt-5 overflow-hidden rounded-[22px] border-[1.5px] border-[#111111] shadow-[var(--flow-shadow)]">
        <div className="px-5 py-5"><p className="text-sm opacity-65">อัตราทำสำเร็จ</p><div className="mt-1 flex items-end gap-1"><span className="font-grotesk text-5xl font-bold tracking-[-0.05em] text-[var(--flow-lime)]">{stats.completionRate}</span><span className="font-grotesk mb-1 text-xl font-bold text-[var(--flow-lime)]">%</span></div></div>
        <div className="h-2 bg-current/15"><div className="flow-bar h-full bg-[var(--flow-lime)]" style={{ width: `${stats.completionRate}%` }} /></div>
        <p className="px-5 py-3 text-xs opacity-60">ช่วง <span className="font-grotesk">{key(from)}</span> ถึง <span className="font-grotesk">{key(to)}</span></p>
      </article>

      <div className="flow-stagger mt-3 grid grid-cols-2 gap-3">
        {cards.map(({ label, value, suffix, icon: Icon, warning }, index) => (
          <article key={label} className={`flow-card min-h-32 rounded-2xl p-4 ${index === cards.length - 1 ? "col-span-2" : ""} ${warning ? "border-amber-600" : ""}`}>
            <div className="flex items-center justify-between"><p className="text-xs text-[var(--flow-muted)]">{label}</p><Icon size={16} className={warning ? "text-[var(--flow-warning)]" : "text-[var(--flow-muted)]"} aria-hidden /></div>
            <p className={`mt-4 text-2xl font-bold ${warning ? "text-[var(--flow-warning)]" : ""}`}><span className="font-grotesk">{value}</span> <span className="text-xs font-medium">{suffix}</span></p>
          </article>
        ))}
      </div>

      <p className="mt-4 text-xs leading-5 text-[var(--flow-muted)]">ตัวเลขทั้งหมดคำนวณจากงานที่บันทึกจริง ไม่มีคะแนนหรือแนวโน้มที่สร้างขึ้นเอง</p>
    </section>
  );
}
