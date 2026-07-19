"use client";
import type { ReactNode } from "react";

// Segmented control with a sliding indicator that animates to the active option.
export function Segmented<T extends string>({ options, value, onChange, size = "sm" }:
  { options: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; size?: "sm" | "lg" }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  const big = size === "lg";
  return (
    <div className={`relative flex rounded-full border-[1.5px] border-[var(--flow-ink)] p-1 font-semibold ${big ? "text-base" : "text-xs"}`}>
      {/* sliding pill */}
      <div
        className="pointer-events-none absolute bottom-1 top-1 rounded-full bg-[var(--flow-ink)] transition-transform duration-300 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${n})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`relative z-10 flex-1 rounded-full transition-colors duration-200 ${big ? "py-3" : "py-1.5"} ${o.value === value ? "text-[var(--flow-lime)]" : "text-[var(--flow-ink)]"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
