"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";

const STEPS = [
  "อ่านงานของคุณ",
  "คำนวณเวลาเดินทางในกรุงเทพ",
  "จัดลำดับตารางตามเดดไลน์",
  "หาช่วงที่เสี่ยงเครียด",
  "สร้างแผน เร็วสุด / เครียดน้อยสุด",
  "เกือบเสร็จแล้ว",
];

export function PlanningOverlay({ open, taskCount, onCancel }: { open: boolean; taskCount: number; onCancel?: () => void }) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [pct, setPct] = useState(6);

  // mount on open; exit then unmount on close
  useEffect(() => {
    if (open) { setRender(true); setStep(0); setPct(6); return; }
    setShow(false);
    const t = setTimeout(() => setRender(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  // flip to visible only AFTER the element has mounted (two frames) so the enter transition runs
  useEffect(() => {
    if (!render || !open) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShow(true)));
    return () => cancelAnimationFrame(r);
  }, [render, open]);

  useEffect(() => {
    if (!render) return;
    const s = setInterval(() => setStep((i) => Math.min(i + 1, STEPS.length - 1)), 3000);
    const p = setInterval(() => setPct((v) => (v < 95 ? v + Math.max(1, Math.round((95 - v) / 12)) : v)), 600);
    return () => { clearInterval(s); clearInterval(p); };
  }, [render]);

  if (!render) return null;
  const current = step === 0
    ? <>อ่านงานของคุณ <span className="font-grotesk">{taskCount}</span> รายการ</>
    : STEPS[step];

  return (
    <>
      <div className={`fixed inset-0 z-40 mx-auto max-w-[420px] bg-white/55 backdrop-blur-[2px] transition-opacity duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${show ? "opacity-100" : "opacity-0"}`} />
      <div className="fixed inset-x-0 bottom-20 z-50 mx-auto max-w-[420px] px-4">
        <div className={`rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${show ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"}`}>
          <div className="flex items-end justify-between">
            <span className="text-sm font-semibold">กำลังวางแผนวันให้คุณ</span>
            <span className="font-grotesk text-sm font-bold">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full rounded-full bg-[var(--flow-ink)] transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[var(--flow-ink)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--flow-ink)]" />
            </span>
            <span className="text-sm">{current}</span>
          </div>
          <div className="mt-3 flex gap-1.5">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-[var(--flow-ink)]" : i === step ? "bg-[var(--flow-lime)]" : "bg-neutral-200"}`} />
            ))}
          </div>
          {onCancel && (
            <button onClick={onCancel} className="flow-press mt-3 w-full rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2 text-sm font-semibold">ยกเลิก</button>
          )}
        </div>
      </div>
    </>
  );
}
