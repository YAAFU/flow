import { estimateTravelMin, type Place } from "./places";

// Real driving routes/times via OSRM public demo server (free, no API key).
// OSRM uses free-flow speeds, so we scale up to approximate Bangkok traffic.
const OSRM = "https://router.project-osrm.org";
const BKK_TRAFFIC = 1.5; // multiplier on free-flow driving time

export type Pt = { lat: number; lng: number };
const asPlace = (p: Pt): Place => ({ name: "", lat: p.lat, lng: p.lng });
const coordStr = (pts: Pt[]) => pts.map((p) => `${p.lng},${p.lat}`).join(";");

export type RouteResult = {
  geometry: [number, number][]; // [lng,lat][]
  legs: { durationMin: number; distanceKm: number }[];
  fallback: boolean;
};

// duration matrix (minutes) between every pair - one OSRM "table" call.
// Never throws - falls back to haversine estimates.
export async function durationTable(pts: Pt[]): Promise<{ durations: number[][]; fallback: boolean }> {
  try {
    const url = `${OSRM}/table/v1/driving/${coordStr(pts)}?annotations=duration`;
    const r = await fetch(url, { headers: { "User-Agent": "Flow-HacKaTech/1.0" } });
    if (!r.ok) throw new Error(`osrm table ${r.status}`);
    const d = (await r.json()) as { durations: (number | null)[][] };
    return {
      durations: d.durations.map((row) =>
        row.map((sec) => (sec == null ? 0 : Math.round((sec / 60) * BKK_TRAFFIC))),
      ),
      fallback: false,
    };
  } catch (e) {
    console.error("[osrm] table failed, haversine:", e instanceof Error ? e.message : e);
    return {
      durations: pts.map((a) => pts.map((b) => (a === b ? 0 : estimateTravelMin(asPlace(a), asPlace(b))))),
      fallback: true,
    };
  }
}

// real road geometry + per-leg duration/distance for an ordered route.
// Never throws - falls back to straight lines + haversine.
export async function roadRoute(pts: Pt[]): Promise<RouteResult> {
  try {
    const url = `${OSRM}/route/v1/driving/${coordStr(pts)}?overview=full&geometries=geojson&annotations=duration,distance`;
    const r = await fetch(url, { headers: { "User-Agent": "Flow-HacKaTech/1.0" } });
    if (!r.ok) throw new Error(`osrm route ${r.status}`);
    const d = (await r.json()) as {
      routes: { geometry: { coordinates: [number, number][] }; legs: { duration: number; distance: number }[] }[];
    };
    const rt = d.routes?.[0];
    if (!rt) throw new Error("osrm no route");
    return {
      geometry: rt.geometry.coordinates,
      legs: rt.legs.map((l) => ({
        durationMin: Math.round((l.duration / 60) * BKK_TRAFFIC),
        distanceKm: +(l.distance / 1000).toFixed(1),
      })),
      fallback: false,
    };
  } catch (e) {
    console.error("[osrm] route failed, haversine:", e instanceof Error ? e.message : e);
    return {
      geometry: pts.map((p) => [p.lng, p.lat] as [number, number]),
      legs: pts.slice(1).map((p, i) => ({ durationMin: estimateTravelMin(asPlace(pts[i]), asPlace(p)), distanceKm: 0 })),
      fallback: true,
    };
  }
}
