"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MonthGrid } from "@/components/MonthGrid";
import { FlowDialog } from "@/components/ui/flow-dialog";
import { formatThaiMonthYear, parseDateKey } from "@/lib/time";
import type { FlowState } from "@/lib/types";

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

export function TaskDatePicker({ initialDate, today, tasksByDay, onPick, onClose }: {
  initialDate: string;
  today: string;
  tasksByDay: FlowState["tasksByDay"];
  onPick: (date: string) => void;
  onClose: () => void;
}) {
  const initial = parseDateKey(initialDate) ?? parseDateKey(today)!;
  const [cursor, setCursor] = useState({ year: initial.year, month: initial.month - 1 });
  const load = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
    return Object.fromEntries(Object.entries(tasksByDay)
      .filter(([date, tasks]) => date.startsWith(prefix) && tasks.length > 0)
      .map(([date, tasks]) => [Number(date.slice(-2)), Math.min(1, tasks.length / 6)]));
  }, [cursor, tasksByDay]);
  const selected = parseDateKey(initialDate);
  const current = parseDateKey(today);

  const shiftMonth = (amount: number) => setCursor((value) => {
    const next = value.month + amount;
    return { year: value.year + Math.floor(next / 12), month: ((next % 12) + 12) % 12 };
  });

  return (
    <FlowDialog
      title="เลือกวันเพื่อสร้าง flow_ ใหม่"
      description="เลือกวันที่ตั้งแต่วันนี้เป็นต้นไป เมื่อเลือกแล้วฟอร์มเพิ่มงานจะเปิดทันที"
      onClose={onClose}
    >
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="เดือนก่อนหน้า" onClick={() => shiftMonth(-1)} className="flow-press grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-muted)]"><ChevronLeft size={18} /></button>
        <h3 aria-live="polite" className="font-grotesk text-base font-bold">{formatThaiMonthYear(cursor.year, cursor.month)}</h3>
        <button type="button" aria-label="เดือนถัดไป" onClick={() => shiftMonth(1)} className="flow-press grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-muted)]"><ChevronRight size={18} /></button>
      </div>
      <MonthGrid
        compact
        pickMode
        year={cursor.year}
        month={cursor.month}
        load={load}
        minDate={today}
        selected={selected?.year === cursor.year && selected.month - 1 === cursor.month ? selected.day : undefined}
        today={current?.year === cursor.year && current.month - 1 === cursor.month ? current.day : undefined}
        onPick={(day) => onPick(dateKey(cursor.year, cursor.month, day))}
      />
      <button type="button" onClick={onClose} className="flow-press mx-auto mt-5 block min-h-11 rounded-full border-[1.5px] border-[var(--flow-ink)] px-6 text-sm font-semibold">ยกเลิก</button>
    </FlowDialog>
  );
}
