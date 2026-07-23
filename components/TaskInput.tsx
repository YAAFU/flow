"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Clock3, FileText, Plus, SlidersHorizontal, Star } from "lucide-react";
import { LocationDisclosure } from "@/components/location/LocationDisclosure";
import {
  buildTaskFromFormDraft,
  createSubmitGuard,
  estimatedFinish,
  isTaskTitleValid,
  taskToFormDraft,
  validateDuration,
  validateStartTime,
  validateTaskFormDraft,
  type RepeatDraft,
  type TaskFormDraft,
} from "@/lib/task-form";
import { taskLocationFromFlat, taskLocationToFlat, type TaskLocation } from "@/lib/location";
import type { Category, Task } from "@/lib/types";

const PRIORITIES = [
  ["urgent", "ด่วน"],
  ["high", "สำคัญมาก"],
  ["normal", "ปกติ"],
  ["flex", "ยืดได้"],
] as const;
const PRIORITY_LABEL: Record<Task["priority"], string> = { urgent: "ด่วน", high: "สำคัญมาก", normal: "ปกติ", flex: "ยืดได้" };
const DURATION_OPTIONS = [["30 นาที", 30], ["1 ชั่วโมง", 60], ["2 ชั่วโมง", 120], ["3 ชั่วโมง", 180], ["ครึ่งวัน 4 ชั่วโมง", 240]] as const;
const REMINDER_OPTIONS = [[0, "ตรงเวลา"], [5, "5 นาที"], [10, "10 นาที"], [30, "30 นาที"], [60, "1 ชั่วโมง"]] as const;
type ExpandedRow = "time" | "priority" | "advanced" | null;

function CollapsibleRow({ icon, label, summary, open, onToggle, children }: {
  icon: React.ReactNode;
  label: string;
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const contentId = useId();
  return (
    <div className="rounded-xl bg-[var(--flow-surface)]">
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]">
        <span className="flex shrink-0 items-center gap-2">{icon}<span className="font-medium">{label}</span></span>
        <span className="flex min-w-0 items-center gap-1.5 text-right text-xs text-[var(--flow-muted)]"><span className="truncate">{summary}</span><ChevronDown aria-hidden size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div id={contentId} className="flow-expand flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

function patchDraft(setDraft: React.Dispatch<React.SetStateAction<TaskFormDraft>>, patch: Partial<TaskFormDraft>) {
  setDraft((current) => ({ ...current, ...patch }));
}

export function TaskInput({
  onAdd,
  editing,
  onSave,
  onCancel,
  order = 0,
  categories = [],
  date,
  quickLocations,
}: {
  onAdd: (task: Task, repeat: RepeatDraft) => void | Promise<void>;
  editing?: Task | null;
  onSave?: (task: Task, repeat: RepeatDraft) => void | Promise<void>;
  onCancel?: () => void;
  order?: number;
  categories?: Category[];
  date?: string;
  quickLocations?: readonly TaskLocation[];
}) {
  const [draft, setDraft] = useState<TaskFormDraft>(() => taskToFormDraft(editing));
  const [location, setLocation] = useState<TaskLocation | null>(() => taskLocationFromFlat(editing ?? {}));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(editing));
  const [expanded, setExpanded] = useState<ExpandedRow>(null);
  const [customReminder, setCustomReminder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const submitGuard = useRef(createSubmitGuard());
  const titleInputRef = useRef<HTMLInputElement>(null);
  const formId = useId();
  const titleId = `${formId}-title`;
  const titleHintId = `${formId}-title-hint`;
  const titleErrorId = `${formId}-title-error`;
  const detailsId = `${formId}-details`;
  const startTimeId = `${formId}-start-time`;
  const deadlineDateId = `${formId}-deadline-date`;
  const deadlineTimeId = `${formId}-deadline-time`;
  const errorId = `${formId}-error`;
  const duration = validateDuration(draft.durationSet, draft.durationHours, draft.durationMinutes);
  const startTime = validateStartTime(!draft.allDay && draft.timeSet, draft.time);
  const toggle = (row: Exclude<ExpandedRow, null>) => setExpanded((current) => current === row ? null : row);

  const toggleReminder = (value: number) => {
    const exists = draft.reminderOffsets.includes(value);
    patchDraft(setDraft, { reminderOffsets: exists ? draft.reminderOffsets.filter((item) => item !== value) : [...draft.reminderOffsets, value] });
  };

  const changeCustomReminder = (raw: string) => {
    setCustomReminder(raw);
    const known = new Set(REMINDER_OPTIONS.map(([value]) => value));
    const withoutCustom = draft.reminderOffsets.filter((value) => known.has(value as typeof REMINDER_OPTIONS[number][0]));
    const parsed = Number(raw);
    patchDraft(setDraft, { reminderOffsets: raw !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 10080 ? [...withoutCustom, parsed] : withoutCustom });
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setTitleTouched(true);
    if (locationBusy) {
      setError("กรุณารอให้ค้นหาตำแหน่งปัจจุบันเสร็จก่อนบันทึกงาน");
      return;
    }
    const validation = validateTaskFormDraft(draft);
    if (!validation.success) {
      if (!isTaskTitleValid(draft.title)) {
        titleInputRef.current?.focus();
      } else {
        setError(validation.error);
      }
      if (validation.error.includes("เวลา") || validation.error.includes("ระยะเวลา") || validation.error.includes("ชั่วโมง") || validation.error.includes("นาที")) {
        setDetailsOpen(true);
        setExpanded("time");
      } else if (validation.error.includes("เส้นตาย") || validation.error.includes("แจ้งเตือน")) {
        setDetailsOpen(true);
        setExpanded("advanced");
      }
      return;
    }
    if (!submitGuard.current.tryLock()) return;
    setSubmitting(true);
    try {
      const { task, repeat } = buildTaskFromFormDraft(draft, {
        editing,
        order,
        additionalFields: taskLocationToFlat(location),
      });
      if (editing) {
        if (!onSave) throw new Error("ไม่พบคำสั่งบันทึกงาน");
        await onSave(task, repeat);
      } else {
        await onAdd(task, repeat);
      }
      setDraft(taskToFormDraft());
      setLocation(null);
      setCustomReminder("");
    } catch (reason) {
      submitGuard.current.release();
      setSubmitting(false);
      setError(reason instanceof Error && reason.message ? reason.message : "บันทึกงานไม่สำเร็จ ข้อมูลที่กรอกไว้ยังอยู่ กรุณาลองอีกครั้ง");
    }
  }

  const timeSummary = draft.allDay
    ? "ทั้งวัน"
    : draft.timeSet
      ? startTime.fixedTime
        ? `เริ่ม ${startTime.fixedTime}${draft.lockTime ? " · ล็อก" : ""}`
        : "เลือกเวลาเริ่ม"
      : "ให้ AI จัดเวลา";
  const durationSummary = duration.durationMin ? `${duration.durationMin} นาที` : "รอ AI ประเมิน";
  const advancedCount = Number(Boolean(draft.deadlineDate)) + Number(Boolean(draft.categoryId)) + Number(draft.repeat.frequency !== "none") + draft.reminderOffsets.length + Number(Boolean(draft.note.trim()));
  const configuredDetailCount = Number(Boolean(location)) + Number(draft.allDay || draft.timeSet || draft.durationSet) + Number(draft.priority !== "normal") + advancedCount;
  const titleError = titleTouched && !isTaskTitleValid(draft.title) ? "กรุณากรอกชื่องาน" : "";

  return (
    <form className="flex min-w-0 flex-col gap-3 pb-[env(safe-area-inset-bottom)]" onSubmit={submit} noValidate>
      <div>
        <label htmlFor={titleId} className="mb-1.5 block text-sm font-semibold">
          ชื่องาน <span aria-hidden className="text-[var(--flow-warning)]">*</span>
        </label>
      <input
        ref={titleInputRef}
        id={titleId}
        data-autofocus="true"
        required
        value={draft.title}
        onBlur={() => setTitleTouched(true)}
        onChange={(event) => {
          patchDraft(setDraft, { title: event.target.value });
          if (error === "กรุณากรอกชื่องาน") setError("");
        }}
        placeholder="ทำอะไร?"
        autoComplete="off"
        enterKeyHint="done"
        aria-invalid={Boolean(titleError)}
        aria-describedby={`${titleHintId}${titleError ? ` ${titleErrorId}` : ""}`}
        className="h-13 w-full min-w-0 scroll-mt-24 rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-[var(--flow-paper)] px-3 text-base font-semibold outline-none placeholder:font-normal placeholder:text-[var(--flow-muted)] focus-visible:ring-2 focus-visible:ring-[var(--flow-lime)]"
      />
        <p id={titleHintId} className="mt-1.5 text-xs leading-5 text-[var(--flow-muted)]">กรอกแค่ชื่องานก็เพิ่มได้ รายละเอียดอื่นใส่ภายหลังได้</p>
        {titleError && <p id={titleErrorId} role="alert" className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--flow-warning)]"><AlertCircle aria-hidden size={14} />{titleError}</p>}
      </div>

      <button
        type="button"
        aria-expanded={detailsOpen}
        aria-controls={detailsId}
        onClick={() => setDetailsOpen((current) => !current)}
        className="flow-press flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[var(--flow-line)] px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]"
      >
        <span className="flex items-center gap-2 font-semibold"><SlidersHorizontal aria-hidden size={16} />เพิ่มรายละเอียด</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--flow-muted)]">
          <span className="truncate">{configuredDetailCount ? `ตั้งค่าแล้ว ${configuredDetailCount} รายการ` : "ไม่บังคับ"}</span>
          <ChevronDown aria-hidden size={15} className={`shrink-0 transition-transform ${detailsOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {detailsOpen && <div id={detailsId} className="flow-expand flex min-w-0 flex-col gap-2">
      <LocationDisclosure value={location} onChange={setLocation} onBusyChange={setLocationBusy} title="สถานที่" quickLocations={quickLocations} />

      <CollapsibleRow icon={<Clock3 aria-hidden size={16} className="text-[var(--flow-muted)]" />} label="เมื่อไหร่" open={expanded === "time"} onToggle={() => toggle("time")} summary={`${timeSummary} · ${durationSummary}`}>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={draft.allDay} onChange={(event) => patchDraft(setDraft, { allDay: event.target.checked, lockTime: event.target.checked ? false : draft.lockTime })} className="h-5 w-5 accent-[#111111]" />
          งานทั้งวัน
        </label>
        {!draft.allDay && <>
          <button type="button" role="switch" aria-checked={draft.timeSet} onClick={() => patchDraft(setDraft, { timeSet: !draft.timeSet, lockTime: draft.timeSet ? false : draft.lockTime })} className="flex min-h-11 w-full items-center justify-between text-sm"><span className="font-medium">กำหนดเวลาเริ่มเอง</span><span aria-hidden className={`relative h-6 w-11 rounded-full transition-colors ${draft.timeSet ? "bg-[var(--flow-ink)]" : "bg-[var(--flow-line)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${draft.timeSet ? "left-[22px]" : "left-0.5"}`} /></span></button>
          {draft.timeSet && <>
            <label htmlFor={startTimeId} className="flex min-h-11 flex-wrap items-center gap-2 text-sm"><span className="text-xs text-[var(--flow-muted)]">เริ่ม</span><input id={startTimeId} type="time" required value={draft.time} onChange={(event) => patchDraft(setDraft, { time: event.target.value })} className="font-grotesk h-10 min-w-0 flex-1 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2" /></label>
            <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" checked={draft.lockTime} onChange={(event) => patchDraft(setDraft, { lockTime: event.target.checked })} className="h-5 w-5 accent-[#111111]" />ล็อกเวลานี้ (ห้าม AI เลื่อน)</label>
          </>}
        </>}

        <div className="border-t border-[var(--flow-line)] pt-2">
          <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">ระยะเวลา</span><button type="button" aria-pressed={!draft.durationSet} onClick={() => patchDraft(setDraft, { durationSet: false, durationHours: 0, durationMinutes: 0 })} className={`min-h-9 rounded-full border px-3 text-xs ${!draft.durationSet ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>ให้ AI ประเมิน</button></div>
          <div className="mt-2 flex flex-wrap gap-1.5">{DURATION_OPTIONS.map(([label, value]) => <button type="button" aria-pressed={draft.durationSet && duration.durationMin === value} key={value} onClick={() => patchDraft(setDraft, { durationSet: true, durationHours: Math.floor(value / 60), durationMinutes: value % 60 })} className={`min-h-9 rounded-full border px-3 text-xs ${draft.durationSet && duration.durationMin === value ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>{label}</button>)}</div>
          {draft.durationSet && <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="กำหนดระยะเวลาเอง">
            <label className="flex items-center gap-1 text-xs text-[var(--flow-muted)]"><span>ชั่วโมง</span><input aria-label="จำนวนชั่วโมง" type="number" min={0} max={24} value={draft.durationHours} onChange={(event) => patchDraft(setDraft, { durationHours: Number(event.target.value) })} className="font-grotesk h-10 w-16 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2 text-sm" /></label>
            <label className="flex items-center gap-1 text-xs text-[var(--flow-muted)]"><span>นาที</span><input aria-label="จำนวนนาที" type="number" min={0} max={59} value={draft.durationMinutes} onChange={(event) => patchDraft(setDraft, { durationMinutes: Number(event.target.value) })} className="font-grotesk h-10 w-16 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2 text-sm" /></label>
            {startTime.fixedTime && duration.durationMin && <span className="text-xs text-[var(--flow-muted)]">เสร็จประมาณ <span className="font-grotesk">{estimatedFinish(startTime.fixedTime, duration.durationMin)}</span></span>}
          </div>}
          {duration.error && draft.durationSet && <p role="alert" className="mt-1 text-xs font-semibold text-[var(--flow-warning)]">{duration.error}</p>}
        </div>
      </CollapsibleRow>

      <CollapsibleRow icon={<Star aria-hidden size={16} className="text-[var(--flow-muted)]" />} label="ความสำคัญ" open={expanded === "priority"} onToggle={() => toggle("priority")} summary={PRIORITY_LABEL[draft.priority]}>
        <div className="flex flex-wrap gap-1.5">{PRIORITIES.map(([value, label]) => <button type="button" aria-pressed={draft.priority === value} key={value} onClick={() => { patchDraft(setDraft, { priority: value }); setExpanded(null); }} className={`min-h-10 rounded-full border px-3 text-xs font-medium ${draft.priority === value ? "border-[var(--flow-lime-dark)] bg-[var(--flow-lime)] text-[#111111]" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>{label}</button>)}</div>
      </CollapsibleRow>

      <CollapsibleRow icon={<FileText aria-hidden size={16} className="text-[var(--flow-muted)]" />} label="รายละเอียดเพิ่มเติม" open={expanded === "advanced"} onToggle={() => toggle("advanced")} summary={advancedCount ? `ตั้งค่าแล้ว ${advancedCount} รายการ` : "ไม่บังคับ"}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label htmlFor={deadlineDateId} className="text-xs font-semibold">เส้นตายวันที่<input id={deadlineDateId} type="date" min={date} value={draft.deadlineDate} onChange={(event) => patchDraft(setDraft, { deadlineDate: event.target.value })} className="font-grotesk mt-1 h-11 w-full min-w-0 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2" /></label>
          <label htmlFor={deadlineTimeId} className="text-xs font-semibold">เวลา<input id={deadlineTimeId} type="time" disabled={!draft.deadlineDate} value={draft.deadlineTime} onChange={(event) => patchDraft(setDraft, { deadlineTime: event.target.value })} className="font-grotesk mt-1 h-11 w-full min-w-0 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2 disabled:opacity-45" /></label>
        </div>
        <label className="text-xs font-semibold">หมวดหมู่<select value={draft.categoryId} onChange={(event) => patchDraft(setDraft, { categoryId: event.target.value })} className="mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="">ไม่มีหมวดหมู่</option>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        {!editing && <label className="text-xs font-semibold">ทำซ้ำ<select value={draft.repeat.frequency} onChange={(event) => patchDraft(setDraft, { repeat: { frequency: event.target.value as RepeatDraft["frequency"] } })} className="mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2"><option value="none">ไม่ทำซ้ำ</option><option value="daily">ทุกวัน</option><option value="weekly">ทุกสัปดาห์</option><option value="monthly">ทุกเดือน</option><option value="yearly">ทุกปี</option></select></label>}
        <fieldset><legend className="text-xs font-semibold">แจ้งเตือนก่อนเริ่ม</legend><div className="mt-1 flex flex-wrap gap-1.5">{REMINDER_OPTIONS.map(([value, label]) => <label key={value} className={`flex min-h-10 items-center gap-1.5 rounded-xl border px-2.5 text-xs ${draft.reminderOffsets.includes(value) ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-[var(--flow-line)]"}`}><input type="checkbox" className="sr-only" checked={draft.reminderOffsets.includes(value)} onChange={() => toggleReminder(value)} />{draft.reminderOffsets.includes(value) && <span aria-hidden>✓</span>}{label}</label>)}</div></fieldset>
        <label className="text-xs">กำหนดแจ้งเตือนเอง (นาที)<input type="number" min={0} max={10080} value={customReminder} onChange={(event) => changeCustomReminder(event.target.value)} className="font-grotesk mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3" /></label>
        <label className="text-xs font-semibold">โน้ต<textarea rows={3} value={draft.note} onChange={(event) => patchDraft(setDraft, { note: event.target.value })} className="mt-1 w-full resize-y rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] p-3" /></label>
      </CollapsibleRow>
      </div>}

      {error && <p id={errorId} role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--flow-warning)] p-3 text-sm font-semibold text-[var(--flow-warning)]"><AlertCircle aria-hidden size={17} className="mt-0.5 shrink-0" />{error}</p>}
      <p role="status" aria-live="polite" className="sr-only">{submitting ? (editing ? "กำลังบันทึกงาน" : "กำลังเพิ่มงาน") : ""}</p>
      <div className="sticky bottom-0 z-10 -mx-1 mt-1 flex gap-2 bg-[var(--flow-paper)] px-1 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-2">
        {editing && <button type="button" onClick={onCancel} className="flow-press min-h-12 rounded-xl border-[1.5px] border-[var(--flow-ink)] px-4 text-sm font-semibold">ยกเลิก</button>}
        <button type="submit" disabled={submitting || locationBusy} className="flow-press flow-inverse flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">
          {locationBusy ? "กำลังค้นหาตำแหน่ง…" : submitting ? "กำลังบันทึก…" : editing ? "บันทึกงาน" : <>เพิ่มงาน <Plus aria-hidden size={16} className="text-[var(--flow-lime)]" /></>}
        </button>
      </div>
    </form>
  );
}
