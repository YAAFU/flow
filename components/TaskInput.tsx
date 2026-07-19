"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from "react";
import { MapPin, Search, Plus, Clock, Star, ChevronDown } from "lucide-react";
import type { Task } from "@/lib/types";
import { BKK_PLACES } from "@/lib/places";
import { LocationPicker } from "@/components/LocationPicker";

const PRIORITIES = [["urgent", "ด่วน"], ["high", "สำคัญมาก"], ["normal", "ปกติ"], ["flex", "ยืดได้"]] as const;
const PRIO_LABEL: Record<Task["priority"], string> = { urgent: "ด่วน", high: "สำคัญมาก", normal: "ปกติ", flex: "ยืดได้" };

function endOf(start: string, durMin: number): string {
  const [h, m] = start.split(":").map(Number);
  const t = (h * 60 + m + (Number.isFinite(durMin) ? durMin : 0)) % (24 * 60);
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtDur(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return [h ? `${h} ชม` : "", m ? `${m} น` : ""].filter(Boolean).join(" ") || "0 น";
}
type Picked = { name: string; lat?: number; lng?: number };
type Hit = { name: string; lat: number; lng: number };

// One collapsible field row: icon + label + current value summary, toggles a body open.
function Row({ icon, label, summary, open, onToggle, children }:
  { icon: React.ReactNode; label: string; summary: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-neutral-50">
      <button onClick={onToggle} className="flex w-full items-center justify-between px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2">{icon}<span className="font-medium">{label}</span></span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-500">{summary}<ChevronDown size={14} className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div className="flex flex-col gap-2 px-3 pb-3">{children}</div>}
    </div>
  );
}

export function TaskInput({ onAdd, editing, onSave, onCancel }:
  { onAdd: (t: Task) => void; editing?: Task | null; onSave?: (t: Task) => void; onCancel?: () => void }) {
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState<Picked>({ ...BKK_PLACES["สยาม"] });
  const [time, setTime] = useState("12:00");
  const [dur, setDur] = useState(60);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [timeSet, setTimeSet] = useState(false); // user pinned a start time (else AI schedules it)
  const [durSet, setDurSet] = useState(false);   // user gave a duration (else AI estimates)
  const [lockTime, setLockTime] = useState(false); // anchor: AI must keep this exact start

  // which field is expanded - all collapsed by default (Reminders-style progressive disclosure)
  const [open, setOpen] = useState<null | "loc" | "time" | "prio">(null);
  const toggle = (k: "loc" | "time" | "prio") => setOpen((v) => (v === k ? null : k));

  // when an existing task is selected for editing, load its values into the form
  useEffect(() => {
    if (!editing) return;
    setTitle(editing.title);
    setPlace({ name: editing.place, lat: editing.lat, lng: editing.lng });
    setTime(editing.fixedTime ?? editing.deadline ?? "12:00");
    setTimeSet(!!(editing.fixedTime ?? editing.deadline));
    setLockTime(!!editing.lockTime);
    setDur(editing.durationMin ?? 60);
    setDurSet(editing.durationMin != null);
    setPriority(editing.priority);
    setOpen(null);
  }, [editing]);

  // real place search (Nominatim via /api/geocode)
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        setHits(await r.json());
      } catch { setHits([]); } finally { setSearching(false); }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  function clearForm() {
    setTitle(""); setQuery(""); setHits([]); setOpen(null);
    setPlace({ ...BKK_PLACES["สยาม"] }); setTime("12:00"); setDur(60); setPriority("normal");
    setTimeSet(false); setDurSet(false); setLockTime(false);
  }
  function submit() {
    if (!title.trim()) return;
    const t: Task = {
      id: editing?.id ?? crypto.randomUUID(), title: title.trim(),
      place: place.name, lat: place.lat, lng: place.lng,
      fixedTime: timeSet ? time : undefined,
      lockTime: timeSet && lockTime ? true : undefined,
      durationMin: durSet ? dur : undefined,
      priority,
    };
    if (editing && onSave) onSave(t); else onAdd(t);
    clearForm();
  }

  const hasRealPin = place.lat != null;

  return (
    <div className="flex flex-col gap-2.5">
      {/* title - the focal field, type + ✓ saves on its own */}
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ทำอะไร?" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        className="w-full border-b-2 border-[var(--flow-ink)] bg-transparent pb-1.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-neutral-300" />

      {/* 📍 location */}
      <Row icon={<MapPin size={15} className={hasRealPin ? "text-[var(--flow-ink)]" : "text-neutral-400"} />}
        label="ที่ไหน" open={open === "loc"} onToggle={() => toggle("loc")}
        summary={<>{place.name}{hasRealPin && <span className="font-grotesk text-[10px] text-neutral-400">พิกัดจริง</span>}</>}>
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาสถานที่จริง"
            className="w-full rounded-lg border border-[var(--flow-ink)] bg-white py-1.5 pl-8 pr-2.5 text-xs outline-none placeholder:text-neutral-400" />
          {(searching || hits.length > 0) && query.trim().length >= 2 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border-[1.5px] border-[var(--flow-ink)] bg-white shadow-lg">
              {searching && <div className="px-3 py-2 text-xs text-neutral-400">กำลังค้นหา...</div>}
              {!searching && hits.length === 0 && <div className="px-3 py-2 text-xs text-neutral-400">ไม่พบสถานที่</div>}
              {hits.map((h, i) => (
                <button key={i} onClick={() => { setPlace({ name: h.name, lat: h.lat, lng: h.lng }); setQuery(""); setHits([]); setOpen(null); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-100">
                  <MapPin size={13} className="shrink-0 text-neutral-400" /><span className="line-clamp-1">{h.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(BKK_PLACES).map((k) => (
            <button key={k} onClick={() => { setPlace({ ...BKK_PLACES[k] }); setOpen(null); }}
              className={`rounded-full border px-2.5 py-1 text-xs ${place.name === k ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-neutral-300 text-neutral-500"}`}>{k}</button>
          ))}
        </div>
        <button onClick={() => setPickerOpen(true)} className="flow-press flex items-center gap-1.5 self-start rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 py-1 text-xs font-semibold"><MapPin size={13} /> ปักหมุดบนแผนที่</button>
      </Row>
      <LocationPicker open={pickerOpen} onClose={() => setPickerOpen(false)}
        initial={place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : undefined}
        onPick={(l) => { setPlace({ name: l.name, lat: l.lat, lng: l.lng }); setPickerOpen(false); setOpen(null); }} />

      {/* 🕐 time + duration — both optional; AI fills the rest */}
      <Row icon={<Clock size={15} className="text-neutral-400" />} label="เมื่อไหร่" open={open === "time"} onToggle={() => toggle("time")}
        summary={timeSet ? <>เริ่ม <span className="font-grotesk">{time}</span>{lockTime && " · ล็อก"}{durSet ? <> · {fmtDur(dur)}</> : " · AI ประเมิน"}</> : "ให้ AI จัดเวลา"}>
        {/* start time */}
        <button onClick={() => setTimeSet((v) => !v)} className="flex items-center justify-between text-sm">
          <span className="font-medium">กำหนดเวลาเริ่มเอง</span>
          <span className={`relative h-5 w-9 rounded-full transition-colors ${timeSet ? "bg-[var(--flow-ink)]" : "bg-neutral-300"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${timeSet ? "left-[18px]" : "left-0.5"}`} />
          </span>
        </button>
        {timeSet ? (
          <>
            <label className="flex items-center gap-2 text-sm"><span className="text-xs text-neutral-400">เริ่ม</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="font-grotesk rounded-lg border border-[var(--flow-ink)] bg-white px-2 py-1 text-sm" /></label>
            <button onClick={() => setLockTime((v) => !v)} className="flex items-center gap-2 self-start text-xs">
              <span className={`flex h-4 w-4 items-center justify-center rounded border-[1.5px] ${lockTime ? "border-[var(--flow-ink)] bg-[var(--flow-ink)]" : "border-neutral-300"}`}>{lockTime && <span className="h-1.5 w-1.5 rounded-[1px] bg-[var(--flow-lime)]" />}</span>
              <span className="text-neutral-600">ล็อกเวลานี้ (ห้าม AI เลื่อน)</span>
            </button>
          </>
        ) : <div className="text-xs text-neutral-400">ไม่ระบุก็ได้ - AI จะหาเวลาที่เหมาะให้</div>}

        {/* duration */}
        <div className="mt-1 border-t border-neutral-200 pt-2">
          <button onClick={() => setDurSet((v) => !v)} className="flex w-full items-center justify-between text-sm">
            <span className="font-medium">กำหนดระยะเวลาเอง</span>
            <span className={`relative h-5 w-9 rounded-full transition-colors ${durSet ? "bg-[var(--flow-ink)]" : "bg-neutral-300"}`}>
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${durSet ? "left-[18px]" : "left-0.5"}`} />
            </span>
          </button>
          {durSet ? (
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-1.5 text-sm"><span className="text-xs text-neutral-400">ใช้เวลา</span>
                <input type="number" value={Math.floor(dur / 60)} min={0} max={23}
                  onChange={(e) => setDur(Math.max(0, +e.target.value) * 60 + (dur % 60))}
                  className="font-grotesk w-12 rounded-lg border border-[var(--flow-ink)] bg-white px-2 py-1 text-sm" />
                <span className="text-xs text-neutral-400">ชม</span>
                <input type="number" value={dur % 60} min={0} max={59} step={15}
                  onChange={(e) => setDur(Math.floor(dur / 60) * 60 + Math.min(59, Math.max(0, +e.target.value)))}
                  className="font-grotesk w-14 rounded-lg border border-[var(--flow-ink)] bg-white px-2 py-1 text-sm" />
                <span className="text-xs text-neutral-400">นาที</span>
                {timeSet && <span className="text-xs text-neutral-500">เสร็จ ~<span className="font-grotesk">{endOf(time, dur)}</span></span>}</label>
              <div className="flex flex-wrap gap-1.5">
                {([["30 นาที", 30], ["1 ชม", 60], ["2 ชม", 120], ["ครึ่งวัน (4 ชม)", 240]] as const).map(([l, v]) => (
                  <button key={v} onClick={() => setDur(v)}
                    className={`rounded-full border px-2.5 py-1 text-xs ${dur === v ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-neutral-300 text-neutral-500"}`}>{l}</button>
                ))}
              </div>
            </div>
          ) : <div className="mt-1.5 text-xs text-neutral-400">ไม่รู้ก็ได้ - AI จะประเมินจากชนิดงานให้</div>}
        </div>
      </Row>

      {/* ⭐ priority */}
      <Row icon={<Star size={15} className="text-neutral-400" />} label="ความสำคัญ" open={open === "prio"} onToggle={() => toggle("prio")}
        summary={PRIO_LABEL[priority]}>
        <div className="flex gap-1.5">
          {PRIORITIES.map(([v, l]) => (
            <button key={v} onClick={() => { setPriority(v); setOpen(null); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priority === v ? "border-[var(--flow-lime)] bg-[var(--flow-lime)] font-semibold" : "border-neutral-300 text-neutral-400"}`}>{l}</button>
          ))}
        </div>
      </Row>

      <div className="mt-1 flex gap-2">
        {editing && (
          <button onClick={() => { clearForm(); onCancel?.(); }}
            className="flow-press rounded-xl border-[1.5px] border-[var(--flow-ink)] px-4 py-3 text-sm font-semibold">ยกเลิก</button>
        )}
        <button onClick={submit} disabled={!title.trim()}
          className="flow-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--flow-ink)] py-3 text-center text-sm font-semibold text-white disabled:opacity-30">
          {editing ? "บันทึกงาน" : <>เพิ่มงาน <Plus size={16} className="text-[var(--flow-lime)]" /></>}</button>
      </div>
    </div>
  );
}
