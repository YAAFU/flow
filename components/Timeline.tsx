"use client";
import { AlertTriangle, Coffee } from "lucide-react";
import type { ScheduleItem } from "@/lib/types";

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
// free gap between the previous task's end (+travel) and this task's start
function gapBefore(items: ScheduleItem[], i: number): number {
  if (i === 0) return 0;
  const gap = toMin(items[i].start) - toMin(items[i - 1].end) - items[i].travelFromPrevMin;
  return gap >= 20 && gap < 600 ? gap : 0; // ignore tiny gaps and midnight wraps
}

export function Timeline({ items, riskPoints }: { items: ScheduleItem[]; riskPoints: { time: string; reason: string }[] }) {
  // remount when the schedule changes (e.g. A/B toggle) so the reveal replays
  const replayKey = items.map((it) => it.start + it.end).join("|");
  return (
    <div key={replayKey} className="flex flex-col">
      {items.map((it, i) => (
        <div key={it.taskId + i} className="flow-rise" style={{ animationDelay: `${i * 90}ms` }}>
          {gapBefore(items, i) > 0 && (
            <div className="flex items-center gap-1.5 py-1.5 pl-1.5 text-[10.5px] text-[var(--flow-text-muted)]">
              <Coffee size={12} className="shrink-0" />
              ว่าง ~<span className="font-grotesk">{gapBefore(items, i)}</span> นาที · พักได้
            </div>
          )}
          {it.travelFromPrevMin > 0 && (
            <div className="flex items-center gap-1.5 py-1.5 pl-1.5 text-[10.5px] text-[var(--flow-text-muted)]">
              <span className="inline-block h-3.5 w-0.5 bg-[repeating-linear-gradient(var(--flow-border-default)_0_3px,transparent_3px_6px)]" />
              เวลาเส้นทางประมาณ <span className="font-grotesk">{it.travelFromPrevMin}</span> นาที · ไม่รวมสภาพจราจรสด
            </div>
          )}
          <div className="grid grid-cols-[46px_1fr] gap-2.5">
            <div className="font-grotesk pt-2.5 text-xs font-semibold">{it.start}</div>
            <div className="mb-2 rounded-xl border-[1.5px] border-[var(--flow-ink)] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold">{it.title}</span>
                {it.aiAdded && <span className="rounded-full bg-[var(--flow-surface-muted)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--flow-text-secondary)]">เติมโดย AI</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--flow-text-muted)]">{it.placeLabel} · <span className="font-grotesk">{it.start}–{it.end}</span></div>
            </div>
          </div>
        </div>
      ))}
      {riskPoints.map((r, i) => (
        <div key={i} className="grid grid-cols-[46px_1fr] gap-2.5 flow-rise" style={{ animationDelay: `${(items.length + i) * 90}ms` }}>
          <div className="font-grotesk pt-2.5 text-xs font-semibold">!</div>
          <div className="flow-inverse mb-2 rounded-xl border-[1.5px] border-[var(--flow-inverse)] px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold"><AlertTriangle size={14} className="text-[var(--flow-lime)]" /> จุดเสี่ยงเครียด · <span className="font-grotesk">{r.time}</span></div>
            <div className="mt-0.5 text-[11px] text-[var(--flow-lime)]">{r.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
