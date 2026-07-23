"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { LocationDisclosure } from "@/components/location/LocationDisclosure";
import { buildSavedPlace } from "@/lib/smart-places";
import type { TaskLocation } from "@/lib/location";
import type { AppSettings, RecentPlace, SavedPlace, SavedPlaceCategory } from "@/lib/types";

const CATEGORIES: readonly [SavedPlaceCategory, string][] = [
  ["home", "บ้าน"],
  ["school", "โรงเรียน"],
  ["university", "มหาวิทยาลัย"],
  ["work", "ที่ทำงาน"],
  ["fitness", "ฟิตเนส"],
  ["custom", "กำหนดเอง"],
];

export function SavedPlacesManager({
  savedPlaces,
  recentPlaces,
  settings,
  onSave,
  onDelete,
  onClearRecent,
  onSettings,
}: {
  savedPlaces: readonly SavedPlace[];
  recentPlaces: readonly RecentPlace[];
  settings: AppSettings;
  onSave: (place: SavedPlace) => void;
  onDelete: (id: string) => void;
  onClearRecent: () => void;
  onSettings: (settings: AppSettings) => void;
}) {
  const [editing, setEditing] = useState<SavedPlace | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [category, setCategory] = useState<SavedPlaceCategory>("custom");
  const [location, setLocation] = useState<TaskLocation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SavedPlace | null>(null);
  const [error, setError] = useState("");

  const openForm = (place?: SavedPlace) => {
    setEditing(place ?? null);
    setLabel(place?.label ?? "");
    setPlaceName(place?.placeName ?? "");
    setCategory(place?.category ?? "custom");
    setLocation(place ? {
      name: place.placeName,
      latitude: place.latitude,
      longitude: place.longitude,
      source: "saved",
    } : null);
    setError("");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setError("");
  };

  const save = () => {
    if (!label.trim()) {
      setError("กรุณาตั้งชื่อสถานที่ประจำ");
      return;
    }
    const actualName = placeName.trim() || location?.name || label.trim();
    onSave(buildSavedPlace({
      existing: editing ?? undefined,
      label,
      placeName: actualName,
      latitude: location?.latitude,
      longitude: location?.longitude,
      category,
    }));
    closeForm();
  };

  return <section className="flow-card rounded-2xl p-4" aria-labelledby="location-settings-heading">
    <p className="font-grotesk text-[10px] font-bold tracking-[0.14em] text-[var(--flow-lime-dark)]">LOCATION</p>
    <div className="mt-1 flex items-start justify-between gap-3">
      <div><h2 id="location-settings-heading" className="font-bold">สถานที่และการเดินทาง</h2><p className="mt-1 text-xs leading-5 text-[var(--flow-muted)]">เรียนรู้จากสถานที่ที่คุณบันทึกลงงานเท่านั้น ไม่มีการติดตามตำแหน่งเบื้องหลัง</p></div>
      <MapPin aria-hidden className="shrink-0 text-[var(--flow-lime-dark)]" size={20} />
    </div>

    <div className="mt-3 space-y-2">
      {savedPlaces.map((place) => <div key={place.id} className="flex min-h-12 items-center gap-2 rounded-xl border border-[var(--flow-line)] px-3">
        <Star aria-hidden size={15} className="shrink-0" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{place.label}</span>{place.placeName !== place.label && <span className="block truncate text-xs text-[var(--flow-muted)]">{place.placeName}</span>}</span>
        <button type="button" aria-label={`แก้ไข ${place.label}`} onClick={() => openForm(place)} className="grid h-11 w-11 place-items-center rounded-xl"><Pencil aria-hidden size={15} /></button>
        <button type="button" aria-label={`ลบ ${place.label}`} onClick={() => setConfirmDelete(place)} className="grid h-11 w-11 place-items-center rounded-xl text-[var(--flow-warning)]"><Trash2 aria-hidden size={15} /></button>
      </div>)}
      <button type="button" onClick={() => openForm()} className="flow-press flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--flow-line)] text-sm font-semibold"><Plus aria-hidden size={15} />เพิ่มสถานที่ประจำ</button>
    </div>

    {formOpen && <div className="flow-expand mt-3 rounded-xl border-[1.5px] border-[var(--flow-ink)] p-3">
      <div className="flex items-center justify-between"><h3 className="font-semibold">{editing ? "แก้ไขสถานที่ประจำ" : "เพิ่มสถานที่ประจำ"}</h3><button type="button" aria-label="ปิดฟอร์มสถานที่ประจำ" onClick={closeForm} className="grid h-11 w-11 place-items-center rounded-xl"><X aria-hidden size={16} /></button></div>
      <label className="mt-2 block text-sm font-semibold">ชื่อที่ใช้เรียก<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="เช่น บ้าน โรงเรียน ที่ทำงาน" className="mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3" /></label>
      <label className="mt-2 block text-sm font-semibold">หมวด<select value={category} onChange={(event) => setCategory(event.target.value as SavedPlaceCategory)} className="mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3">{CATEGORIES.map(([value, text]) => <option value={value} key={value}>{text}</option>)}</select></label>
      <label className="mt-2 block text-sm font-semibold">ชื่อสถานที่จริง<input value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="เก็บเฉพาะชื่อได้ ไม่จำเป็นต้องมีพิกัด" className="mt-1 h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3" /></label>
      <div className="mt-2"><LocationDisclosure value={location} onChange={(next) => { setLocation(next); if (next && !placeName.trim()) setPlaceName(next.name); }} title="ค้นหา/ปักหมุดพิกัด" description="พิกัดเป็นทางเลือก ระบบจะไม่เดาว่าตำแหน่งใดคือบ้านหรือโรงเรียน" /></div>
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-[var(--flow-warning)]">{error}</p>}
      <button type="button" onClick={save} className="flow-press flow-inverse mt-3 min-h-12 w-full rounded-xl font-semibold">บันทึกสถานที่ประจำ</button>
    </div>}

    {confirmDelete && <div role="alertdialog" aria-labelledby="delete-place-title" className="flow-expand mt-3 rounded-xl border-[1.5px] border-[var(--flow-warning)] p-3">
      <p id="delete-place-title" className="font-semibold">ลบ “{confirmDelete.label}”?</p>
      <p className="mt-1 text-xs leading-5 text-[var(--flow-muted)]">งานเก่าจะยังเก็บ snapshot ชื่อและพิกัดเดิมไว้ครบ</p>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setConfirmDelete(null)} className="min-h-11 rounded-xl border border-[var(--flow-line)] font-semibold">ยกเลิก</button><button type="button" onClick={() => { onDelete(confirmDelete.id); setConfirmDelete(null); }} className="min-h-11 rounded-xl bg-[var(--flow-warning)] font-semibold text-white">ยืนยันลบ</button></div>
    </div>}

    <div className="mt-4 space-y-2 border-t flow-hairline pt-3">
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>ใช้ประวัติสถานที่เพื่อแนะนำ</span><input type="checkbox" checked={settings.useLocationHistory} onChange={(event) => onSettings({ ...settings, useLocationHistory: event.target.checked })} className="h-5 w-5" /></label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>แสดง “แนะนำสำหรับคุณ”</span><input type="checkbox" checked={settings.suggestFrequentPlaces} onChange={(event) => onSettings({ ...settings, suggestFrequentPlaces: event.target.checked })} className="h-5 w-5" /></label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm"><span>เสนอให้บันทึกสถานที่ที่ใช้บ่อย</span><input type="checkbox" checked={settings.promptSaveFrequentPlaces} onChange={(event) => onSettings({ ...settings, promptSaveFrequentPlaces: event.target.checked })} className="h-5 w-5" /></label>
      <button type="button" disabled={recentPlaces.length === 0} onClick={onClearRecent} className="flow-press min-h-11 w-full rounded-xl border border-[var(--flow-line)] text-sm font-semibold disabled:opacity-40"><Trash2 aria-hidden size={14} className="mr-1 inline" />ล้างสถานที่ล่าสุด ({recentPlaces.length})</button>
    </div>
  </section>;
}
