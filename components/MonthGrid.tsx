"use client";
export type DayLoad = Record<number, number>; // day-of-month → heat 0..1
const DOW = ["อา","จ","อ","พ","พฤ","ศ","ส"];
const pad = (n: number) => String(n).padStart(2, "0");

export type DayStatus = "done" | "miss" | "pending";
const STATUS_CELL: Record<DayStatus, string> = {
  done: "bg-[var(--flow-lime)] text-[#111111]",
  miss: "border-amber-600 text-[var(--flow-warning)]",
  pending: "bg-[var(--flow-surface)] text-[var(--flow-ink)]",
};
// shape cue so colorblind users can still tell statuses apart (not color-only)
export const STATUS_MARK: Record<DayStatus, string> = { done: "✓", miss: "✕", pending: "•" };
const STATUS_LABEL: Record<DayStatus, string> = { done: "เสร็จแล้ว", miss: "พลาด", pending: "รอดำเนินการ" };

export function MonthGrid({ year, month, load, onPick, selected, labels, compact, today, pickMode, minDate, status }:
  { year: number; month: number; load: DayLoad; onPick: (day: number) => void; selected?: number; labels?: Record<number, string>; compact?: boolean; today?: number; pickMode?: boolean; minDate?: string; status?: Record<number, DayStatus> }) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  // compact = the home calendar. Same elements whether browsing or picking-a-day;
  // pickMode only changes per-cell classes/height so the grid transitions in place.
  if (compact) {
    const EASE = "transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)]";
    return (
      <div>
        <div className={`grid grid-cols-7 text-center text-[9px] text-neutral-400 ${EASE} ${pickMode ? "gap-1" : "gap-0.5"}`}>
          {DOW.map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className={`mt-0.5 grid grid-cols-7 ${EASE} ${pickMode ? "gap-1" : "gap-0.5"}`}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const date = `${year}-${pad(month + 1)}-${pad(d)}`;
            const hasTasks = load[d] != null;
            const isSel = selected === d;
            const isToday = today === d;
            const disabled = !!pickMode && !!minDate && date < minDate;
            let cls: string;
            if (pickMode) {
              cls = disabled
                ? "text-neutral-300"
                : isSel
                  ? "bg-[var(--flow-inverse)] font-bold text-[var(--flow-inverse-text)]"
                  : hasTasks
                    ? "border border-neutral-200 text-neutral-400"
                    : "border-[1.5px] border-[var(--flow-ink)] font-bold text-[var(--flow-ink)]";
            } else {
              const st = status?.[d];
              cls = isSel ? "bg-[var(--flow-inverse)] font-bold text-[var(--flow-inverse-text)]"
                : st ? `${STATUS_CELL[st]} font-semibold`
                : isToday ? "font-bold text-[var(--flow-ink)]" : "text-neutral-600";
            }
            const showDot = hasTasks && !(pickMode && disabled) && !(status?.[d]) && !isSel;
            return (
              <button key={i} disabled={disabled} onClick={() => !disabled && onPick(d)}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSel}
                aria-label={`${d} ${DOW[new Date(year, month, d).getDay()]}${status?.[d] ? ` · ${STATUS_LABEL[status[d]]}` : ""}${hasTasks ? " · มีงาน" : ""}`}
                className={`font-grotesk relative flex flex-col items-center justify-center rounded-lg ${EASE} ${pickMode ? "h-11 text-sm" : "h-8 text-[11px]"} ${cls} ${(pickMode || isSel) && isToday && !disabled ? "ring-2 ring-[var(--flow-lime)]" : ""}`}>
                {d}
                {!pickMode && status?.[d] && !isSel && <span className="absolute right-1 top-0.5 text-[8px] font-bold leading-none">{STATUS_MARK[status[d]]}</span>}
                {showDot && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--flow-ink)]" style={{ opacity: 0.3 + (load[d] ?? 0) * 0.7 }} />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {DOW.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => d === null ? <div key={i} /> : (
          <button key={i} onClick={() => onPick(d)} aria-current={today === d ? "date" : undefined} aria-pressed={selected === d}
            aria-label={`${d} ${DOW[new Date(year, month, d).getDay()]}${status?.[d] ? ` · ${STATUS_LABEL[status[d]]}` : ""}${load[d] != null ? " · มีงาน" : ""}`}
            className={`font-grotesk relative aspect-square rounded-lg border text-xs transition-[transform,background-color,border-color] duration-200 ${selected===d?"border-[var(--flow-ink)] border-[1.5px]":status?.[d]?STATUS_CELL[status[d]]:"flow-hairline"}`}>
            <span className="absolute left-1 top-1">{d}</span>
            {status?.[d] && selected !== d && <span className="absolute right-1 top-1 text-[9px] font-bold leading-none">{STATUS_MARK[status[d]]}</span>}
            {labels?.[d] && (
              <span className="absolute inset-x-0.5 bottom-3 truncate font-sans text-[7px] leading-none text-neutral-500">{labels[d]}</span>
            )}
            {load[d] != null && (
              <span className="absolute bottom-1.5 left-1/2 h-1.5 -translate-x-1/2 rounded-full bg-[var(--flow-ink)]"
                style={{ width: `${6 + load[d]*16}px`, opacity: 0.25 + load[d]*0.75 }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
