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
  const reverseAbortRef = useRef<AbortController | null>(null);
  const reverseSequenceRef = useRef(0);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [name, setName] = useState<string>("");
  const [loadingName, setLoadingName] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const [mapServiceError, setMapServiceError] = useState("");
  const [reverseGeocodeError, setReverseGeocodeError] = useState(false);
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
    reverseSequenceRef.current += 1;
    reverseAbortRef.current?.abort();
    reverseAbortRef.current = null;
    setPin(null);
    setName("");
    setLoadingName(false);
    setMapUnavailable(false);
    setMapServiceError("");
    setReverseGeocodeError(false);

    const start = initial ?? BKK_CENTER;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: ref.current, style: STYLE, center: [start.lng, start.lat], zoom: 13 });
    } catch {
      mapRef.current = null;
      markerRef.current = null;
      const errorFrame = requestAnimationFrame(() => {
        setMapUnavailable(true);
        setMapServiceError("เปิดแผนที่ไม่ได้ในขณะนี้ กรุณายกเลิกแล้วเลือกสถานที่ด้วยวิธีอื่น");
      });
      return () => cancelAnimationFrame(errorFrame);
    }

    const handleMapError = () => {
      setMapServiceError("โหลดข้อมูลแผนที่บางส่วนไม่สำเร็จ คุณยังลองปักหมุดหรือยกเลิกเพื่อเลือกสถานที่ด้วยวิธีอื่นได้");
    };
    mapRef.current = map;
    map.on("error", handleMapError);
    map.on("click", (event) => drop(event.lngLat.lat, event.lngLat.lng));
    if (initial) void drop(initial.lat, initial.lng);
    return () => {
      reverseSequenceRef.current += 1;
      reverseAbortRef.current?.abort();
      reverseAbortRef.current = null;
      map.off("error", handleMapError);
      try { map.remove(); } catch {}
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function drop(lat: number, lng: number) {
    const sequence = ++reverseSequenceRef.current;
    reverseAbortRef.current?.abort();
    const controller = new AbortController();
    reverseAbortRef.current = controller;
    setPin({ lat, lng });
    setName("");
    setReverseGeocodeError(false);
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
      const r = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng }),
        signal: controller.signal,
      });
      if (!r.ok) throw new Error("reverse_geocode_failed");
      const d = await r.json();
      if (sequence === reverseSequenceRef.current) {
        const resolvedName = typeof d?.name === "string" && d.name.trim() ? d.name.trim() : "หมุดที่ปัก";
        setName(resolvedName);
        setReverseGeocodeError(resolvedName === "หมุดที่ปัก");
      }
    } catch (error) {
      if ((error as { name?: string }).name !== "AbortError" && sequence === reverseSequenceRef.current) {
        setName("หมุดที่ปัก");
        setReverseGeocodeError(true);
      }
    } finally {
      if (sequence === reverseSequenceRef.current) setLoadingName(false);
      if (reverseAbortRef.current === controller) reverseAbortRef.current = null;
    }
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
        {mapServiceError && (
          <p role="status" aria-live="polite" className="mt-2 rounded-xl border border-[var(--flow-warning)]/35 bg-[var(--flow-paper)] px-3 py-2 text-xs leading-5 text-[var(--flow-warning)]">
            {mapServiceError}
          </p>
        )}
        <div className="mt-2 min-h-[20px] text-sm">
          {pin ? (
            <span><b>{loadingName ? "กำลังหาชื่อ..." : name}</b> <span className="font-grotesk text-xs text-neutral-400">{pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</span></span>
          ) : <span className="text-neutral-400">ยังไม่ได้ปักหมุด</span>}
        </div>
        {reverseGeocodeError && (
          <p role="status" aria-live="polite" className="mt-1 text-xs leading-5 text-[var(--flow-muted)]">
            หาชื่อสถานที่ไม่ได้ แต่ยังใช้พิกัดหมุดนี้ได้
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={onClose} className="flow-press min-h-11 flex-1 rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2.5 text-sm font-semibold">ยกเลิก</button>
          <button type="button" disabled={!pin || loadingName || mapUnavailable} onClick={() => pin && !loadingName && !mapUnavailable && onPick({ name: name || "หมุดที่ปัก", lat: pin.lat, lng: pin.lng })}
            className="flow-press flex-[2] rounded-xl bg-[var(--flow-ink)] py-2.5 text-sm font-semibold text-white disabled:opacity-40">ใช้ตำแหน่งนี้</button>
        </div>
      </div>
    </>
  );
}
