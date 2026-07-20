"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, ChevronDown, Clock3, Loader2, MapPin, Plus, Search, Star, X } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { BKK_PLACES } from "@/lib/places";
import { createSubmitGuard, estimatedFinish, isTaskTitleValid, validateDuration, validateStartTime } from "@/lib/task-form";
import { createTask } from "@/lib/task-factory";
import { TaskSchema, type Task } from "@/lib/types";

const PRIORITIES = [["high", "สำคัญมาก"], ["normal", "ปกติ"], ["flex", "ยืดได้"]] as const;
const PRIORITY_LABEL: Record<Task["priority"], string> = { urgent: "ด่วน", high: "สำคัญมาก", normal: "ปกติ", flex: "ยืดได้" };

type PickedLocation = { name: string; lat?: number; lng?: number };
type PlaceHit = { name: string; lat: number; lng: number };
type SearchState = "idle" | "loading" | "success" | "empty" | "error";
type ExpandedRow = "location" | "time" | "priority" | null;

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
      <button type="button" aria-expanded={open} aria-controls={contentId} onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2.5 text-sm">
        <span className="flex shrink-0 items-center gap-2">{icon}<span className="font-medium">{label}</span></span>
        <span className="flex min-w-0 items-center gap-1.5 text-right text-xs text-[var(--flow-muted)]"><span className="truncate">{summary}</span><ChevronDown aria-hidden size={14} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div id={contentId} className="flow-expand flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function TaskInput({ onAdd, editing, onSave, onCancel, order = 0 }: {
  onAdd: (task: Task) => void | Promise<void>;
  editing?: Task | null;
  onSave?: (task: Task) => void | Promise<void>;
  onCancel?: () => void;
  order?: number;
}) {
  const [title, setTitle] = useState(() => editing?.title ?? "");
  const [place, setPlace] = useState<PickedLocation>(() => ({ name: editing?.place ?? "", lat: editing?.lat, lng: editing?.lng }));
  const [time, setTime] = useState(() => editing?.fixedTime ?? "12:00");
  const [timeSet, setTimeSet] = useState(() => Boolean(editing?.fixedTime));
  const [lockTime, setLockTime] = useState(() => Boolean(editing?.lockTime));
  const [durationSet, setDurationSet] = useState(() => editing?.durationMin != null);
  const [durationHours, setDurationHours] = useState(() => Math.floor((editing?.durationMin ?? 60) / 60));
  const [durationMinutes, setDurationMinutes] = useState(() => (editing?.durationMin ?? 60) % 60);
  const [priority, setPriority] = useState<Task["priority"]>(() => editing?.priority ?? "normal");
  const [expanded, setExpanded] = useState<ExpandedRow>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbort = useRef<AbortController | null>(null);
  const submitGuard = useRef(createSubmitGuard());
  const formId = useId();
  const titleId = `${formId}-title`;
  const placeSearchId = `${formId}-place-search`;
  const startTimeId = `${formId}-start-time`;
  const errorId = `${formId}-error`;

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchAbort.current?.abort();
    const value = query.trim();
    if (value.length < 2) return;
    searchTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      searchAbort.current = controller;
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("geocode");
        const data: unknown = await response.json();
        const safe = Array.isArray(data) ? data.filter((item): item is PlaceHit => {
          if (typeof item !== "object" || item === null) return false;
          const candidate = item as Partial<PlaceHit>;
          return typeof candidate.name === "string" && typeof candidate.lat === "number" && Number.isFinite(candidate.lat) && typeof candidate.lng === "number" && Number.isFinite(candidate.lng);
        }) : [];
        setHits(safe);
        setSearchState(safe.length ? "success" : "empty");
      } catch (reason) {
        if ((reason as { name?: string }).name === "AbortError") return;
        setHits([]);
        setSearchState("error");
      }
    }, 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchAbort.current?.abort();
    };
  }, [query]);

  const toggle = (row: Exclude<ExpandedRow, null>) => setExpanded((current) => current === row ? null : row);
  const duration = validateDuration(durationSet, durationHours, durationMinutes);
  const startTime = validateStartTime(timeSet, time);

  function resetForm() {
    setTitle("");
    setPlace({ name: "" });
    setTime("12:00");
    setTimeSet(false);
    setLockTime(false);
    setDurationSet(false);
    setDurationHours(1);
    setDurationMinutes(0);
    setPriority("normal");
    setExpanded(null);
    setQuery("");
    setHits([]);
    setSearchState("idle");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!isTaskTitleValid(title)) {
      setError("กรุณากรอกชื่องาน");
      return;
    }
    if (duration.error) {
      setExpanded("time");
      setError(duration.error);
      return;
    }
    if (startTime.error) {
      setExpanded("time");
      setError(startTime.error);
      return;
    }
    if (!submitGuard.current.tryLock()) return;
    setSubmitting(true);
    const now = new Date();
    try {
      const fields = {
        title: title.trim(),
        place: place.name,
        lat: place.lat,
        lng: place.lng,
        fixedTime: startTime.fixedTime,
        lockTime: Boolean(startTime.fixedTime) && lockTime,
        durationMin: duration.durationMin,
        priority,
      };
      const task = editing
        ? TaskSchema.parse({ ...editing, ...fields, id: editing.id, createdAt: editing.createdAt ?? now.toISOString(), updatedAt: now.toISOString() })
        : createTask(fields, order, now);
      if (editing) {
        if (!onSave) throw new Error("ไม่พบคำสั่งบันทึกงาน");
        await onSave(task);
      } else {
        await onAdd(task);
      }
      resetForm();
    } catch {
      submitGuard.current.release();
      setSubmitting(false);
      setError("บันทึกงานไม่สำเร็จ ข้อมูลที่กรอกไว้ยังอยู่ กรุณาลองอีกครั้ง");
    }
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={submit} noValidate>
      <label htmlFor={titleId} className="sr-only">ชื่องาน</label>
      <input
        id={titleId}
        data-autofocus="true"
        value={title}
        onChange={(event) => { setTitle(event.target.value); if (error === "กรุณากรอกชื่องาน") setError(""); }}
        placeholder="ทำอะไร?"
        autoComplete="off"
        aria-invalid={!isTaskTitleValid(title) && Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="w-full border-b-2 border-[var(--flow-ink)] bg-transparent pb-2 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-[var(--flow-muted)] focus-visible:border-[var(--flow-lime-dark)]"
      />

      <CollapsibleRow icon={<MapPin aria-hidden size={16} className={place.lat != null ? "text-[var(--flow-ink)]" : "text-[var(--flow-muted)]"} />} label="ที่ไหน" open={expanded === "location"} onToggle={() => toggle("location")} summary={place.name || "ยังไม่ระบุ"}>
        <div className="relative">
          <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--flow-muted)]" />
          <label htmlFor={placeSearchId} className="sr-only">ค้นหาสถานที่</label>
          <input id={placeSearchId} value={query} onChange={(event) => { const value = event.target.value; setQuery(value); setHits([]); setSearchState(value.trim().length >= 2 ? "loading" : "idle"); }} placeholder="ค้นหาสถานที่" className="h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime)]" />
        </div>
        {query.trim().length >= 2 && searchState !== "idle" && (
          <div role="status" aria-live="polite" className="overflow-hidden rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)]">
            {searchState === "loading" && <p className="flex min-h-11 items-center gap-2 px-3 text-xs text-[var(--flow-muted)]"><Loader2 aria-hidden size={14} className="animate-spin" />กำลังค้นหา…</p>}
            {searchState === "empty" && <p className="px-3 py-3 text-xs text-[var(--flow-muted)]">ไม่พบสถานที่ ลองใช้คำค้นอื่นหรือข้ามส่วนนี้ได้</p>}
            {searchState === "error" && <p className="flex items-start gap-2 px-3 py-3 text-xs text-[var(--flow-warning)]"><AlertCircle aria-hidden size={14} className="mt-0.5 shrink-0" />ค้นหาสถานที่ไม่ได้ในขณะนี้ คุณยังเพิ่มงานโดยไม่ระบุสถานที่ได้</p>}
            {searchState === "success" && hits.map((hit) => (
              <button type="button" key={`${hit.lat}-${hit.lng}-${hit.name}`} onClick={() => { setPlace(hit); setQuery(""); setHits([]); setSearchState("idle"); setExpanded(null); }} className="flex min-h-11 w-full items-center gap-2 border-b border-[var(--flow-line)] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[var(--flow-surface)]">
                <MapPin aria-hidden size={14} className="shrink-0 text-[var(--flow-muted)]" /><span className="line-clamp-2">{hit.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(BKK_PLACES).map(([name, location]) => (
            <button type="button" key={name} onClick={() => { setPlace(location); setExpanded(null); }} className={`min-h-9 rounded-full border px-3 text-xs ${place.name === name ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>{name}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPickerOpen(true)} className="flow-press min-h-10 rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 text-xs font-semibold"><MapPin aria-hidden size={13} className="mr-1 inline" />ปักหมุดบนแผนที่</button>
          {place.name && <button type="button" aria-label="ล้างสถานที่" onClick={() => setPlace({ name: "" })} className="flow-press min-h-10 rounded-full border border-[var(--flow-line)] px-3 text-xs"><X aria-hidden size={13} className="mr-1 inline" />ไม่ระบุสถานที่</button>}
        </div>
      </CollapsibleRow>

      <LocationPicker key={`${place.lat ?? "none"}-${place.lng ?? "none"}`} open={pickerOpen} onClose={() => setPickerOpen(false)} initial={place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : undefined} onPick={(location) => { setPlace(location); setPickerOpen(false); setExpanded(null); }} />

      <CollapsibleRow icon={<Clock3 aria-hidden size={16} className="text-[var(--flow-muted)]" />} label="เมื่อไหร่" open={expanded === "time"} onToggle={() => toggle("time")} summary={timeSet ? startTime.fixedTime ? `เริ่ม ${startTime.fixedTime}${lockTime ? " · ล็อก" : ""}${duration.durationMin ? ` · ${duration.durationMin} นาที` : " · AI ประเมิน"}` : "เลือกเวลาเริ่ม" : "ให้ AI จัดเวลา"}>
        <button type="button" role="switch" aria-checked={timeSet} onClick={() => setTimeSet((value) => !value)} className="flex min-h-11 items-center justify-between text-sm"><span className="font-medium">กำหนดเวลาเริ่มเอง</span><span aria-hidden className={`relative h-6 w-11 rounded-full transition-colors ${timeSet ? "bg-[var(--flow-ink)]" : "bg-[var(--flow-line)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${timeSet ? "left-[22px]" : "left-0.5"}`} /></span></button>
        {timeSet && <>
          <label htmlFor={startTimeId} className="flex min-h-11 items-center gap-2 text-sm"><span className="text-xs text-[var(--flow-muted)]">เริ่ม</span><input id={startTimeId} type="time" required value={time} onChange={(event) => setTime(event.target.value)} className="font-grotesk h-10 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2" /></label>
          <button type="button" role="checkbox" aria-checked={lockTime} onClick={() => setLockTime((value) => !value)} className="flex min-h-11 items-center gap-2 text-left text-xs"><span aria-hidden className={`grid h-5 w-5 place-items-center rounded border-[1.5px] ${lockTime ? "border-[var(--flow-ink)] bg-[var(--flow-ink)]" : "border-[var(--flow-line)]"}`}>{lockTime && <span className="h-2 w-2 rounded-sm bg-[var(--flow-lime)]" />}</span>ล็อกเวลานี้ (ห้าม AI เลื่อน)</button>
        </>}
        <div className="border-t border-[var(--flow-line)] pt-2">
          <button type="button" role="switch" aria-checked={durationSet} onClick={() => setDurationSet((value) => !value)} className="flex min-h-11 w-full items-center justify-between text-sm"><span className="font-medium">กำหนดระยะเวลาเอง</span><span aria-hidden className={`relative h-6 w-11 rounded-full transition-colors ${durationSet ? "bg-[var(--flow-ink)]" : "bg-[var(--flow-line)]"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${durationSet ? "left-[22px]" : "left-0.5"}`} /></span></button>
          {durationSet && <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-[var(--flow-muted)]"><span className="sr-only">จำนวนชั่วโมง</span><input type="number" min={0} max={24} value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} className="font-grotesk h-10 w-16 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2 text-sm" />ชม.</label>
              <label className="flex items-center gap-1 text-xs text-[var(--flow-muted)]"><span className="sr-only">จำนวนนาที</span><input type="number" min={0} max={59} value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))} className="font-grotesk h-10 w-16 rounded-lg border border-[var(--flow-line)] bg-[var(--flow-paper)] px-2 text-sm" />นาที</label>
              {startTime.fixedTime && duration.durationMin && <span className="text-xs text-[var(--flow-muted)]">เสร็จประมาณ <span className="font-grotesk">{estimatedFinish(startTime.fixedTime, duration.durationMin)}</span></span>}
            </div>
            {duration.error && <p role="alert" className="text-xs font-semibold text-[var(--flow-warning)]">{duration.error}</p>}
            <div className="flex flex-wrap gap-1.5">{([["30 นาที", 30], ["1 ชั่วโมง", 60], ["2 ชั่วโมง", 120], ["ครึ่งวัน 4 ชั่วโมง", 240]] as const).map(([label, value]) => <button type="button" key={value} onClick={() => { setDurationHours(Math.floor(value / 60)); setDurationMinutes(value % 60); }} className={`min-h-9 rounded-full border px-3 text-xs ${duration.durationMin === value ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>{label}</button>)}</div>
          </div>}
        </div>
      </CollapsibleRow>

      <CollapsibleRow icon={<Star aria-hidden size={16} className="text-[var(--flow-muted)]" />} label="ความสำคัญ" open={expanded === "priority"} onToggle={() => toggle("priority")} summary={PRIORITY_LABEL[priority]}>
        <div className="flex flex-wrap gap-1.5">{PRIORITIES.map(([value, label]) => <button type="button" aria-pressed={priority === value} key={value} onClick={() => { setPriority(value); setExpanded(null); }} className={`min-h-10 rounded-full border px-3 text-xs font-medium ${priority === value ? "border-[var(--flow-lime-dark)] bg-[var(--flow-lime)] text-[#111111]" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}>{label}</button>)}</div>
      </CollapsibleRow>

      {error && <p id={errorId} role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--flow-warning)] p-3 text-sm font-semibold text-[var(--flow-warning)]"><AlertCircle aria-hidden size={17} className="mt-0.5 shrink-0" />{error}</p>}
      <div className="mt-1 flex gap-2">
        {editing && <button type="button" onClick={onCancel} className="flow-press min-h-12 rounded-xl border-[1.5px] border-[var(--flow-ink)] px-4 text-sm font-semibold">ยกเลิก</button>}
        <button type="submit" disabled={!isTaskTitleValid(title) || submitting} className="flow-press flow-inverse flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-35">
          {submitting ? <><Loader2 aria-hidden size={16} className="animate-spin" />กำลังบันทึก…</> : editing ? "บันทึกงาน" : <>เพิ่มงาน <Plus aria-hidden size={16} className="text-[var(--flow-lime)]" /></>}
        </button>
      </div>
    </form>
  );
}
