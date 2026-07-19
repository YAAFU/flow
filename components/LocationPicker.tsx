"use client";
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BKK_CENTER } from "@/lib/places";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
export type PickedLoc = { name: string; lat: number; lng: number };

export function LocationPicker({ open, onClose, onPick, initial }:
  { open: boolean; onClose: () => void; onPick: (l: PickedLoc) => void; initial?: { lat: number; lng: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(initial ?? null);
  const [name, setName] = useState<string>("");
  const [loadingName, setLoadingName] = useState(false);

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
      <div className="fixed inset-0 z-40 mx-auto max-w-[420px] bg-black/30" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[420px] rounded-t-2xl border-t-[1.5px] border-[var(--flow-ink)] bg-white p-4 pb-7">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-neutral-300" />
        <h3 className="text-base font-bold">แตะแผนที่เพื่อปักหมุดสถานที่</h3>
        <div ref={ref} className="mt-2 h-[300px] w-full overflow-hidden rounded-xl border-[1.5px] border-[var(--flow-ink)]" />
        <div className="mt-2 min-h-[20px] text-sm">
          {pin ? (
            <span><b>{loadingName ? "กำลังหาชื่อ..." : name}</b> <span className="font-grotesk text-xs text-neutral-400">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span></span>
          ) : <span className="text-neutral-400">ยังไม่ได้ปักหมุด</span>}
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={onClose} className="flow-press flex-1 rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2.5 text-sm font-semibold">ยกเลิก</button>
          <button disabled={!pin} onClick={() => pin && onPick({ name: name || "หมุดที่ปัก", lat: pin.lat, lng: pin.lng })}
            className="flow-press flex-[2] rounded-xl bg-[var(--flow-ink)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">ใช้ตำแหน่งนี้</button>
        </div>
      </div>
    </>
  );
}
