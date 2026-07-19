"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Category, Priority, Task } from "@/lib/types";
import { createTask } from "@/lib/task-factory";

export interface RepeatDraft { frequency: "none" | "daily" | "weekly" | "monthly" | "yearly"; }

export function TaskComposer({ categories, date, order, onAdd }: { categories: Category[]; date: string; order: number; onAdd: (task: Task, repeat: RepeatDraft) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="flow-press flow-inverse flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-[1.5px] border-[#111111] font-semibold shadow-[var(--flow-shadow-small)]" onClick={() => setOpen(true)}><span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--flow-lime)] text-[#111111]"><Plus size={18} aria-hidden /></span>เพิ่มงาน</button>;

  return (
    <form className="flow-form flow-sheet rounded-[22px] border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] p-4 shadow-[var(--flow-shadow)]" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const allDay = data.get("allDay") === "on";
      const start=String(data.get("start")||""); const end=String(data.get("end")||"");
      const [startHour,startMinute]=start.split(":").map(Number); const [endHour,endMinute]=end.split(":").map(Number);
      const normalizedDuration=start&&end?Math.max(15,(endHour*60+endMinute)-(startHour*60+startMinute)):Number(data.get("duration")||60);
      const task = createTask({
        title: String(data.get("title") ?? "").trim(),
        place: String(data.get("place") ?? "").trim(),
        fixedTime: allDay ? undefined : start || undefined,
        durationMin: normalizedDuration,
        allDay,
        lockTime: data.get("lockTime") === "on",
        deadlineDate: String(data.get("deadlineDate") || "") || undefined,
        deadlineTime: String(data.get("deadlineTime") || "") || undefined,
        priority: String(data.get("priority") || "normal") as Priority,
        categoryId: String(data.get("category") || "") || undefined,
        reminderOffsets: data.getAll("reminder").map(String).filter(Boolean).map(Number),
        note: String(data.get("note") ?? ""),
      }, order);
      onAdd(task, { frequency: String(data.get("repeat") || "none") as RepeatDraft["frequency"] });
      event.currentTarget.reset();
      setOpen(false);
    }}>
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">เพิ่มงานในวัน</h2><button type="button" aria-label="ปิด" className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-ink)]" onClick={() => setOpen(false)}><X size={18} /></button></div>
      <label className="block text-sm font-semibold" htmlFor="task-title">ชื่องาน</label>
      <input id="task-title" name="title" required autoFocus className="mt-1 h-12 w-full rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-transparent px-3 outline-none focus-visible:ring-4 focus-visible:ring-[var(--flow-lime)]" />
      <label className="mt-3 block text-sm font-semibold" htmlFor="task-place">สถานที่</label>
      <input id="task-place" name="place" className="mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-3" />
      <div className="mt-3 grid grid-cols-2 gap-2"><label className="text-sm font-semibold">เริ่ม<input name="start" type="time" step="900" className="font-grotesk mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-2" /></label><label className="text-sm font-semibold">จบ<input name="end" type="time" step="900" className="font-grotesk mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-2" /></label></div>
      <label className="mt-3 block text-sm font-semibold">ระยะเวลา (ใช้เมื่อไม่ระบุเวลาจบ)<select name="duration" defaultValue="60" className="font-grotesk mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="15">15 นาที</option><option value="30">30 นาที</option><option value="45">45 นาที</option><option value="60">1 ชั่วโมง</option><option value="90">1.5 ชั่วโมง</option><option value="120">2 ชั่วโมง</option></select></label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">เส้นตายวันที่<input name="deadlineDate" type="date" min={date} className="font-grotesk mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-2" /></label>
        <label className="text-sm font-semibold">เวลา<input name="deadlineTime" type="time" className="font-grotesk mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-2" /></label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-sm font-semibold">ความสำคัญ<select name="priority" className="mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="urgent">ด่วน</option><option value="high">สำคัญ</option><option value="normal">ปกติ</option><option value="flex">ยืดหยุ่น</option></select></label>
        <label className="text-sm font-semibold">หมวดหมู่<select name="category" className="mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="">ไม่มีหมวดหมู่</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
      </div>
      <label className="mt-3 block text-sm font-semibold">ทำซ้ำ<select name="repeat" className="mt-1 h-12 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="none">ไม่ทำซ้ำ</option><option value="daily">ทุกวัน</option><option value="weekly">ทุกสัปดาห์</option><option value="monthly">ทุกเดือน</option><option value="yearly">ทุกปี</option></select></label>
      <fieldset className="mt-3"><legend className="text-sm font-semibold">แจ้งเตือนก่อนเริ่ม</legend><div className="mt-1 flex flex-wrap gap-2">{[[0,"ตรงเวลา"],[5,"5 นาที"],[10,"10 นาที"],[30,"30 นาที"],[60,"1 ชั่วโมง"]].map(([value,label]) => <label key={value} className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--flow-line)] px-3"><input name="reminder" type="checkbox" value={value} />{label}</label>)}</div></fieldset>
      <label className="mt-2 block text-sm">กำหนดเอง (นาที)<input name="reminder" type="number" min="0" max="10080" className="font-grotesk mt-1 h-11 w-full rounded-xl border bg-transparent px-3" /></label>
      <label className="mt-3 flex min-h-11 items-center gap-2"><input name="allDay" type="checkbox" />งานทั้งวัน</label>
      <label className="flex min-h-11 items-center gap-2"><input name="lockTime" type="checkbox" />ล็อกเวลา ไม่ให้ AI ขยับ</label>
      <label className="mt-2 block text-sm font-semibold">โน้ต<textarea name="note" rows={2} className="mt-1 w-full rounded-xl border border-[var(--flow-line)] bg-transparent p-3" /></label>
      <button className="flow-press flow-inverse mt-4 h-14 w-full rounded-2xl font-semibold" type="submit">บันทึกงาน</button>
    </form>
  );
}
