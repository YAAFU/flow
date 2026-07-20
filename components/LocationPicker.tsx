"use client";
/* eslint-disable react-hooks/immutability */
import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BKK_CENTER } from "@/lib/places";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export type PickedLoc = { name: string; lat: number; lng: number };

export function LocationPicker({ open, onClose, onPick, initial }:
  { open: boolean; onClose: () => void; onPick: (l: PickedLoc) => void; initial?: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [name, setName] = useState<string>("");
  const [loadingName, setLoadingName] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button:not([disabled]),[tabindex='0']")?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>("button:not([disabled]),[tabindex='0']")];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
      previous?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !ref.current) return;
    const start = initial ?? BKK_CENTER;
    const map = new maplibregl.Map({ container: ref.current, style: STYLE, center: [start.lng, start.lat], zoom: 13, attributionControl: false });
    mapRef.current = map;
    map.on("click", (e) => drop(e.lngLat.lat, e.lngLat.lng));
    if (initial) drop(initial.lat, initial.lng);
    return () => { try { map.remove(); } catch {} mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function drop(lat: number, lng: number) {
    setPin({ lat, lng });
    const map = mapRef.current;
    if (map) {
      if (!markerRef.current) {
        const el = document.createElement("div");
        el.style.cssText = "width:26px;height:26px;border-radius:50%;background:#111;color:#d6ff3f;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,.35)";
        el.textContent = "📍";
        markerRef.current = new maplibregl.Marker({ element: el, anchor: "center" });
      }
      markerRef.current.setLngLat([lng, lat]).addTo(map);
    }
    setLoadingName(true);
    try {
      const r = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
      const d = await r.json();
      setName(d?.name ?? "หมุดที่ปัก");
    } catch { setName("หมุดที่ปัก"); } finally { setLoadingName(false); }
  }

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px]" onMouseDown={onClose} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="fixed inset-x-0 bottom-0 z-[80] mx-auto max-h-[92dvh] max-w-[420px] overflow-y-auto rounded-t-2xl border-t-[1.5px] border-[var(--flow-ink)] bg-[var(--flow-paper)] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--flow-shadow)]">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-neutral-300" />
        <div className="flex items-center justify-between gap-3">
          <h3 id={titleId} className="text-base font-bold">แตะแผนที่เพื่อปักหมุดสถานที่</h3>
          <button type="button" aria-label="ปิดแผนที่" onClick={onClose} className="flow-press grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[var(--flow-line)]"><X size={18} /></button>
        </div>
        <p id={descriptionId} className="sr-only">เลือกตำแหน่งจริงบนแผนที่ แล้วกดใช้ตำแหน่งนี้เพื่อกลับไปยังฟอร์มงาน</p>
        <div ref={ref} tabIndex={0} aria-label="แผนที่สำหรับเลือกตำแหน่ง" className="mt-2 h-[min(300px,42dvh)] w-full overflow-hidden rounded-xl border-[1.5px] border-[var(--flow-ink)]" />
        <div className="mt-2 min-h-[20px] text-sm">
          {pin ? (
            <span><b>{loadingName ? "กำลังหาชื่อ..." : name}</b> <span className="font-grotesk text-xs text-neutral-400">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span></span>
          ) : <span className="text-neutral-400">ยังไม่ได้ปักหมุด</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flow-press min-h-11 flex-1 rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2.5 text-sm font-semibold">ยกเลิก</button>
          <button type="button" disabled={!pin} onClick={() => pin && onPick({ name: name || "หมุดที่ปัก", lat: pin.lat, lng: pin.lng })}
            className="flow-press flex-[2] rounded-xl bg-[var(--flow-ink)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">ใช้ตำแหน่งนี้</button>
        </div>
      </div>
    </>
  );
}
