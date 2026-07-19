"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ScheduleItem } from "@/lib/types";
import { resolvePlace, BKK_CENTER } from "@/lib/places";

const STYLE = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"; // no-key monochrome

type Stop = { label: string; lat?: number; lng?: number; travelFromPrevMin: number; start: string; end: string };
type Leg = { durationMin: number; distanceKm: number };

// names already geocoded this session (null = Nominatim couldn't find it either)
const geoCache = new Map<string, { lat: number; lng: number } | null>();

export function FlowMap({ items, coords, focus: focusProp, onFocus }: { items: ScheduleItem[]; coords?: Record<string, { lat: number; lng: number }>; focus?: number; onFocus?: React.Dispatch<React.SetStateAction<number>> }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [failed, setFailed] = useState(false);
  const [focusState, setFocusState] = useState(-1); // -1 = overview, else stop index
  const focus = focusProp ?? focusState;
  const setFocus = onFocus ?? setFocusState;
  const [legs, setLegs] = useState<Leg[]>([]);
  const [, setGeoVersion] = useState(0); // bump to re-render when geoCache gains entries

  // keep EVERY schedule item so stop numbers always match the plan order -
  // unresolved places just have no pin instead of silently shifting the numbering
  const stops: Stop[] = items.map((it) => {
    const p = coords?.[it.taskId] ?? resolvePlace(it.placeLabel) ?? geoCache.get(it.placeLabel) ?? undefined;
    return { label: it.placeLabel, lat: p?.lat, lng: p?.lng, travelFromPrevMin: it.travelFromPrevMin, start: it.start, end: it.end };
  });

  // names neither the task coords nor the built-in list know → ask Nominatim once
  useEffect(() => {
    const unknown = stops
      .filter((s) => s.lat == null && s.label.trim().length >= 2 && !geoCache.has(s.label))
      .map((s) => s.label);
    if (unknown.length === 0) return;
    let cancelled = false;
    (async () => {
      for (const label of [...new Set(unknown)]) {
        try {
          const r = await fetch(`/api/geocode?q=${encodeURIComponent(label)}`);
          const hits = (await r.json()) as { lat: number; lng: number }[];
          geoCache.set(label, hits[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null);
        } catch {
          geoCache.set(label, null);
        }
      }
      if (!cancelled) setGeoVersion((v) => v + 1);
    })();
    return () => { cancelled = true; };
  }, [JSON.stringify(stops.map((s) => [s.label, s.lat == null]))]);
  const located = stops
    .map((s, i) => (s.lat != null && s.lng != null ? { i, lat: s.lat, lng: s.lng } : null))
    .filter((x): x is { i: number; lat: number; lng: number } => x !== null);
  // routeIdx[stopIndex] → position in the OSRM coord list (for leg lookup)
  const routeIdx: Record<number, number> = {};
  located.forEach((l, idx) => { routeIdx[l.i] = idx; });

  useEffect(() => {
    if (!ref.current || failed || located.length === 0) return;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: ref.current, style: STYLE, center: [BKK_CENTER.lng, BKK_CENTER.lat], zoom: 11, attributionControl: false });
      mapRef.current = map;
      map.on("error", () => setFailed(true));
      map.on("load", async () => {
        // numbered pins - stops at the same coordinates share ONE pin listing
        // every stop number (otherwise pins stack and only the top number shows)
        const groups = new Map<string, { lat: number; lng: number; nums: number[] }>();
        located.forEach((l) => {
          const key = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
          const g = groups.get(key) ?? { lat: l.lat, lng: l.lng, nums: [] };
          g.nums.push(l.i + 1);
          groups.set(key, g);
        });
        groups.forEach((g) => {
          const el = document.createElement("div");
          el.textContent = g.nums.join("·");
          el.style.cssText = "min-width:30px;height:30px;padding:0 8px;border-radius:15px;background:#111;color:#d6ff3f;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Space Grotesk';box-shadow:0 1px 6px rgba(0,0,0,.3)";
          new maplibregl.Marker({ element: el }).setLngLat([g.lng, g.lat]).addTo(map);
        });

        // real road route via OSRM (fallback to straight line inside the API)
        let geometry: [number, number][] = located.map((l) => [l.lng, l.lat]);
        try {
          const r = await fetch("/api/route", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "route", coords: located.map((l) => ({ lat: l.lat, lng: l.lng })) }),
          });
          const data = await r.json();
          if (Array.isArray(data?.geometry) && data.geometry.length) geometry = data.geometry;
          if (Array.isArray(data?.legs)) setLegs(data.legs);
        } catch { /* keep straight line */ }

        if (!map.getSource("route")) {
          map.addSource("route", { type: "geojson", data: { type: "Feature", geometry: { type: "LineString", coordinates: geometry }, properties: {} } });
          map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#111", "line-width": 4, "line-opacity": 0.85 } });
        }

        const b = geometry.reduce((bb, c) => bb.extend(c as [number, number]), new maplibregl.LngLatBounds(geometry[0] as [number, number], geometry[0] as [number, number]));
        map.fitBounds(b, { padding: 45 });
      });
    } catch { setFailed(true); }
    return () => { try { map?.remove(); } catch {} mapRef.current = null; };
  }, [failed, JSON.stringify(located.map((l) => [l.lat, l.lng]))]);

  // step-through: fly to the focused stop (if it has coordinates)
  useEffect(() => {
    const map = mapRef.current;
    const s = focus >= 0 ? stops[focus] : null;
    if (!map || !s || s.lat == null || s.lng == null) return;
    map.flyTo({ center: [s.lng, s.lat], zoom: 15, duration: 700 });
  }, [focus]);

  function next() {
    setFocus((f) => (f + 1 >= stops.length ? -1 : f + 1)); // loop: ...last → overview → first
  }
  function overview() {
    setFocus(-1);
    const map = mapRef.current;
    if (map && located.length) {
      const b = located.reduce((bb, l) => bb.extend([l.lng, l.lat]), new maplibregl.LngLatBounds([located[0].lng, located[0].lat], [located[0].lng, located[0].lat]));
      map.fitBounds(b, { padding: 45, duration: 700 });
    }
  }

  if (failed) return <FallbackMap labels={stops.map((s) => s.label)} />;
  const cur = focus >= 0 ? stops[focus] : null;
  // leg distance only when this stop and the previous one are consecutive on the road route
  const leg = cur && focus > 0 && routeIdx[focus] != null && routeIdx[focus - 1] === routeIdx[focus] - 1
    ? legs[routeIdx[focus] - 1] : null;

  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} className="h-[300px] w-full overflow-hidden rounded-2xl border-[1.5px] border-[var(--flow-ink)]" />

      {/* controls + current-stop status: sticky so the active step stays visible while the list scrolls */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-2 bg-white/95 px-1 pb-1 pt-1 backdrop-blur">
      {/* step-through controls */}
      <div className="flex items-center gap-2">
        <button onClick={overview} className={`flow-press rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 py-1.5 text-xs font-semibold ${focus < 0 ? "bg-[var(--flow-ink)] text-[var(--flow-lime)]" : ""}`}>ภาพรวม</button>
        <button onClick={next} className="flow-press flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--flow-ink)] py-1.5 text-center text-xs font-semibold text-white">
          {focus < 0 ? "เริ่มดูทีละจุด" : focus + 1 >= stops.length ? "กลับภาพรวม" : "จุดถัดไป"}
          {focus + 1 >= stops.length ? <RotateCcw size={13} className="text-[var(--flow-lime)]" /> : <ArrowRight size={14} className="text-[var(--flow-lime)]" />}
        </button>
      </div>

      {/* current stop detail */}
      {cur ? (
        <div className="rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-[#fbffe9] p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">จุดที่ <span className="font-grotesk">{focus + 1}</span> · {cur.label}</span>
            <span className="font-grotesk text-xs text-neutral-500">{cur.start}–{cur.end}</span>
          </div>
          {focus > 0 && (
            <div className="mt-1 text-xs text-neutral-600">
              เดินทางจากจุดก่อนหน้า ~<span className="font-grotesk">{cur.travelFromPrevMin}</span> นาที
              {leg?.distanceKm ? <> · <span className="font-grotesk">{leg.distanceKm}</span> กม.</> : null}
            </div>
          )}
          {cur.lat == null && (
            <div className="mt-1 text-xs text-amber-600">ค้นพิกัดของ “{cur.label}” ไม่เจอ - แตะแก้งานแล้วเลือกสถานที่จากช่องค้นหาเพื่อปักหมุด</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-neutral-500">
          ทั้งหมด <span className="font-grotesk">{stops.length}</span> จุดตามลำดับแผน · กด “เริ่มดูทีละจุด” เพื่อไล่ดูเส้นทาง
          {located.length < stops.length && <> · <span className="text-amber-600"><span className="font-grotesk">{stops.length - located.length}</span> จุดยังไม่มีพิกัดบนแผนที่</span></>}
        </div>
      )}
      </div>
    </div>
  );
}

function FallbackMap({ labels }: { labels: string[] }) {
  const pts = [[21, 20], [77, 40], [46, 78], [30, 55]];
  return (
    <div className="relative h-[300px] overflow-hidden rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-[linear-gradient(#fafafa,#fafafa),repeating-linear-gradient(0deg,#f0f0f0_0_1px,transparent_1px_26px),repeating-linear-gradient(90deg,#f0f0f0_0_1px,transparent_1px_26px)]">
      {labels.map((l, i) => (
        <div key={i} className="font-grotesk absolute flex h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--flow-ink)] text-[13px] font-bold text-[var(--flow-lime)]"
          style={{ left: `${pts[i % 4][0]}%`, top: `${pts[i % 4][1]}%` }}>{i + 1}</div>
      ))}
    </div>
  );
}
