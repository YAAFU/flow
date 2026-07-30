"use client";

export function GuideProgress({ current, total = 3 }: { current: number; total?: number }) {
  const value = Math.min(total, Math.max(1, current));
  return (
    <div className="min-w-0" aria-label={`ขั้นที่ ${value} จาก ${total}`}>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold">ทำความรู้จัก Flow</span>
        <span className="font-grotesk text-[var(--flow-muted)]">{value} / {total}</span>
      </div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < value ? "bg-[var(--flow-lime-dark)]" : "bg-[var(--flow-surface-strong)]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
