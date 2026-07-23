"use client";

import { useRef, type KeyboardEvent } from "react";
import { BatteryLow, BatteryMedium, BatteryFull } from "lucide-react";
import type { DayEnergy } from "@/lib/types";

const OPTIONS: Array<{
  value: DayEnergy;
  label: string;
  description: string;
  Icon: typeof BatteryLow;
}> = [
  {
    value: "low",
    label: "น้อย",
    description: "ลดงานหนัก เพิ่มเวลาพัก และลดการเดินทางที่ไม่จำเป็น",
    Icon: BatteryLow,
  },
  {
    value: "medium",
    label: "กลาง",
    description: "จัดแผนสมดุลระหว่างงาน การเดินทาง และเวลาพัก",
    Icon: BatteryMedium,
  },
  {
    value: "high",
    label: "มาก",
    description: "รองรับงานที่ใช้สมาธิมากขึ้น โดยยังเคารพเวลาที่ล็อกไว้",
    Icon: BatteryFull,
  },
];

export function energyDescription(level: DayEnergy): string {
  return OPTIONS.find((option) => option.value === level)?.description ?? OPTIONS[1].description;
}

export function EnergyLevelSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: DayEnergy;
  onChange: (value: DayEnergy) => void;
  disabled?: boolean;
}) {
  const optionRefs = useRef<Array<HTMLInputElement | null>>([]);

  const moveSelection = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (disabled) return;

    let nextIndex: number | undefined;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = OPTIONS.length - 1;
    }

    if (nextIndex === undefined) return;
    event.preventDefault();
    onChange(OPTIONS[nextIndex].value);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <fieldset className="rounded-2xl border-[1.5px] border-[var(--flow-line)] p-3">
      <legend className="px-1 text-sm font-semibold">พลังงานวันนี้</legend>
      <p className="mb-3 text-xs leading-5 text-[var(--flow-muted)]">
        ใช้ระดับพลังงานเป็นบริบทเมื่อให้ AI ช่วยจัดแผน ไม่ใช่การประเมินด้านสุขภาพ
      </p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ระดับพลังงานวันนี้">
        {OPTIONS.map(({ value: optionValue, label, Icon }, index) => {
          const selected = value === optionValue;
          return (
            <label
              key={optionValue}
              className={`flow-press flex min-h-12 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-2 text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--flow-lime-dark)] focus-within:ring-offset-2 ${selected ? "border-[var(--flow-lime-dark)] bg-[var(--flow-accent)] font-bold text-[var(--flow-accent-foreground)]" : "border-[var(--flow-line)]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                ref={(node) => { optionRefs.current[index] = node; }}
                className="sr-only"
                type="radio"
                name="planner-energy"
                value={optionValue}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange(optionValue)}
                onKeyDown={(event) => moveSelection(event, index)}
              />
              <Icon size={16} aria-hidden />
              <span>{label}</span>
              {selected && <span className="sr-only">เลือกอยู่</span>}
            </label>
          );
        })}
      </div>
      <p className="mt-3 min-h-10 rounded-xl bg-[var(--flow-surface)] px-3 py-2 text-xs leading-5" aria-live="polite">
        <strong>{OPTIONS.find((option) => option.value === value)?.label}:</strong> {energyDescription(value)}
      </p>
    </fieldset>
  );
}
