"use client";
import { useState } from "react";
import { MapPin, Search, Sparkles, CalendarCheck } from "lucide-react";
import type { SlotSuggestion, Task } from "@/lib/types";
import { BKK_PLACES } from "@/lib/places";
import { LocationPicker } from "@/components/LocationPicker";

const PRIORITIES = [["high", "สำคัญมาก"], ["normal", "ปกติ"], ["flex", "ยืดได้"]] as const;
type Picked = { name: string; lat?: number; lng?: number };
type Hit = { name: string; lat: number; lng: number };

export function SmartSlotSheet({ open, onOpenChange, monthLoad }:
  { open: boolean; onOpenChange: (o: boolean) => void; monthLoad: Record<number, number> }) {
  const [title, setTitle] = useState("");
  const [place, setPlace] = useState<Picked>({ ...BKK_PLACES["สยาม"] });
  const [dur, setDur] = useState(120);
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const [locOpen, setLocOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [slots, setSlots] = useState<SlotSuggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    try { const r = await fetch(`/api/geocode?q=${encodeURIComponent(q.trim())}`); setHits(await r.json()); } catch { setHits([]); }
  }

  async function find() {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const r = await fetch("/api/smart-slot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newTask: { title: title.trim(), durationMin: dur, place: place.name, priority }, monthLoad }),
      });
      const data = await r.json();
      setSlots(Array.isArray(data) ? data : []);
    } catch { setSlots([]); } finally { setLoading(false); }
  }

  if (!open) return null;
  const hasRealPin = place.lat != null;

  return (
    <>
      <div className="fixed inset-0 z-40 mx-auto max-w-[420px] bg-black/30" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88vh] max-w-[420px] flex-col rounded-t-2xl border-t-[1.5px] border-[var(--flow-ink)] bg-white p-4 pb-7">
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-neutral-300" />
        <h3 className="shrink-0 text-lg font-bold">มีงานใหม่ ลงวันไหนดี?</h3>

        <div className="mt-3 flex flex-col gap-3 overflow-y-auto">
          {/* title */}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="งานอะไร? เช่น ประชุมทีม"
            className="w-full border-b-2 border-[var(--flow-ink)] bg-transparent pb-1.5 text-lg font-semibold outline-none placeholder:font-normal placeholder:text-neutral-300" />

          {/* location (collapsed) */}
          <button onClick={() => setLocOpen((v) => !v)} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5"><MapPin size={15} className={hasRealPin ? "text-[var(--flow-ink)]" : "text-neutral-400"} /><span className="font-medium">{place.name}</span></span>
            <span className="text-xs text-neutral-400">{locOpen ? "ปิด" : "เปลี่ยนสถานที่"}</span>
          </button>
          {locOpen && (
            <div className="flex flex-col gap-2 rounded-xl bg-neutral-50 p-2.5">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input value={query} onChange={(e) => search(e.target.value)} placeholder="ค้นหาสถานที่จริง"
                  className="w-full rounded-lg border border-[var(--flow-ink)] py-1.5 pl-8 pr-2.5 text-xs outline-none placeholder:text-neutral-400" />
                {hits.length > 0 && query.trim().length >= 2 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border-[1.5px] border-[var(--flow-ink)] bg-white shadow-lg">
                    {hits.map((h, i) => (
                      <button key={i} onClick={() => { setPlace({ name: h.name, lat: h.lat, lng: h.lng }); setQuery(""); setHits([]); setLocOpen(false); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-neutral-100"><MapPin size={13} className="shrink-0 text-neutral-400" /><span className="line-clamp-1">{h.name}</span></button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(BKK_PLACES).map((k) => (
                  <button key={k} onClick={() => { setPlace({ ...BKK_PLACES[k] }); setLocOpen(false); }}
                    className={`rounded-full border px-2.5 py-1 text-xs ${place.name === k ? "border-[var(--flow-ink)] bg-[var(--flow-ink)] text-white" : "border-neutral-300 text-neutral-500"}`}>{k}</button>
                ))}
              </div>
              <button onClick={() => setPickerOpen(true)} className="flow-press flex items-center gap-1.5 self-start rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 py-1 text-xs font-semibold"><MapPin size={13} /> ปักหมุดบนแผนที่</button>
            </div>
          )}
          <LocationPicker open={pickerOpen} onClose={() => setPickerOpen(false)}
            initial={place.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : undefined}
            onPick={(l) => { setPlace({ name: l.name, lat: l.lat, lng: l.lng }); setPickerOpen(false); setLocOpen(false); }} />

          {/* duration + priority */}
          <label className="flex items-center gap-1.5 text-sm"><span className="text-xs text-neutral-400">ใช้เวลา</span>
            <input type="number" value={dur} min={15} step={15} onChange={(e) => setDur(+e.target.value)} className="font-grotesk w-20 rounded-lg border border-[var(--flow-ink)] px-2 py-1 text-sm" /><span className="text-xs text-neutral-400">นาที</span></label>
          <div className="flex gap-1.5">
            {PRIORITIES.map(([v, l]) => (
              <button key={v} onClick={() => setPriority(v)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priority === v ? "border-[var(--flow-lime)] bg-[var(--flow-lime)] font-semibold" : "border-neutral-300 text-neutral-400"}`}>{l}</button>
            ))}
          </div>

          <button onClick={find} disabled={!title.trim() || loading}
            className="flow-press flex items-center justify-center gap-1.5 rounded-xl bg-[var(--flow-ink)] py-3 text-sm font-semibold text-white disabled:opacity-30">
            <Sparkles size={16} className="text-[var(--flow-lime)]" /> {loading ? "AI กำลังหาช่อง..." : "หาช่องให้ฉัน"}
          </button>

          {slots?.map((s, i) => (
            <div key={i} className="flow-rise rounded-xl border-[1.5px] border-[var(--flow-ink)] p-3" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-center gap-1.5 text-sm font-semibold"><CalendarCheck size={15} className="text-[var(--flow-ink)]" /><span className="font-grotesk">{s.date} · {s.start}–{s.end}</span></div>
              <div className="mt-1 text-xs text-neutral-600">{s.reason}</div>
              <div className="mt-1 text-xs font-semibold">คุมได้ <span className="font-grotesk">{s.resultingControlScore}%</span></div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
