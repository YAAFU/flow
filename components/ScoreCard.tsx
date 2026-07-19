"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Lightbulb, ChevronDown } from "lucide-react";
import type { ScheduleItem } from "@/lib/types";
import { controlBreakdown } from "@/lib/score";

const fmtMin = (min: number) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  if (h === 0) return <><span className="font-grotesk">{m}</span> นาที</>;
  if (m === 0) return <><span className="font-grotesk">{h}</span> ชม</>;
  return <><span className="font-grotesk">{h}</span> ชม <span className="font-grotesk">{m}</span> นาที</>;
};

export function ScoreCard({ controlScore, freeTimeMin, tip, schedule, riskPoints, planLabel, altPlan }:
  { controlScore: number; freeTimeMin: number; tip: string; schedule?: ScheduleItem[]; riskPoints?: { time: string; reason: string }[];
    planLabel?: string; altPlan?: { label: string; score: number; onSwitch: () => void } }) {
  const [showWhy, setShowWhy] = useState(false);
  const breakdown = schedule ? controlBreakdown(schedule, riskPoints ?? []) : null;
  // grow the bar from 0 → controlScore on mount / when score changes
  const [barW, setBarW] = useState(0);
  useEffect(() => {
    setBarW(0);
    const t = setTimeout(() => setBarW(controlScore), 80);
    return () => clearTimeout(t);
  }, [controlScore]);
  return (
    <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-3.5">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-400">คะแนนคุมเวลา{planLabel ? ` · ${planLabel}` : ""}</div>
          <div className="font-grotesk text-4xl font-bold leading-none">
            {controlScore}<span className="text-base">%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-neutral-400">เวลาว่างนอกตาราง</div>
          <div className="text-2xl font-bold leading-none">{fmtMin(freeTimeMin)}</div>
        </div>
      </div>
      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-neutral-200">
        <div className="flow-bar h-full rounded-full bg-[var(--flow-ink)]" style={{ width: `${barW}%` }} />
      </div>
      {breakdown && (
        <div className="mt-2">
          <button onClick={() => setShowWhy((v) => !v)} className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 underline decoration-dotted">
            คะแนนคิดยังไง? <ChevronDown size={12} className={`transition-transform ${showWhy ? "rotate-180" : ""}`} />
          </button>
          {showWhy && (
            <div className="mt-1.5 rounded-xl bg-neutral-50 p-2.5 text-[11px] leading-relaxed text-neutral-600">
              <div>เริ่มที่ <span className="font-grotesk">100</span> แล้วหักตามตารางจริง:</div>
              {breakdown.parts.length === 0 ? (
                <div>วันนี้ไม่มีอะไรหัก - ตารางโปร่ง เดินทางน้อย ไม่มีจุดเสี่ยง</div>
              ) : (
                breakdown.parts.map((p, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span>{p.label}</span><span className="font-grotesk shrink-0">{p.delta}</span>
                  </div>
                ))
              )}
              <div className="mt-1 border-t border-neutral-200 pt-1 text-neutral-500">
                เวลาว่างนับจากช่วงตื่น <span className="font-grotesk">08:00–24:00</span> ที่ไม่มีงานและไม่ได้เดินทาง
              </div>
            </div>
          )}
        </div>
      )}
      {altPlan && (
        <button onClick={altPlan.onSwitch}
          className="flow-press mt-2 flex w-full items-center justify-between rounded-xl border border-dashed border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-500">
          <span>อยากดูอีกแบบ? สลับเป็น<span className="font-semibold text-[var(--flow-ink)]">{altPlan.label}</span></span>
          <span className="font-grotesk font-semibold">{altPlan.score}% ↗</span>
        </button>
      )}
      <div className="mt-2 flex items-start gap-1.5 text-xs text-neutral-600"><Lightbulb size={14} className="mt-0.5 shrink-0 text-[var(--flow-ink)]" /><span>{tip}</span></div>
    </div>
  );
}
