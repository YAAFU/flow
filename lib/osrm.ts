// Real driving routes/times via OSRM public demo server (free, no API key).
// These are route-engine estimates; live traffic is not available here.
const OSRM = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 6_000;

export type Pt = { lat: number; lng: number };
const coordStr = (pts: Pt[]) => pts.map((p) => `${p.lng},${p.lat}`).join(";");

export type RoadLeg = { durationMin: number; distanceKm: number };

export type TravelLegDisplay =
  | { kind: "ready"; durationMin: number; distanceKm: number }
  | { kind: "loading" }
  | { kind: "unavailable" };

export function travelLegDisplay(
  leg: RoadLeg | null | undefined,
  routeExpected: boolean,
  routeUnavailable: boolean,
): TravelLegDisplay {
  if (
    leg
    && Number.isFinite(leg.durationMin)
    && leg.durationMin >= 0
    && Number.isFinite(leg.distanceKm)
    && leg.distanceKm >= 0
  ) {
    return { kind: "ready", durationMin: leg.durationMin, distanceKm: leg.distanceKm };
  }
  if (routeExpected && !routeUnavailable) return { kind: "loading" };
  return { kind: "unavailable" };
}

export type RouteResult = {
  geometry: [number, number][]; // [lng,lat][]
  legs: RoadLeg[];
  fallback: boolean;
};

// duration matrix (minutes) between every pair - one OSRM "table" call.
// Never throws. A failed provider returns an explicitly unavailable result;
// callers must not substitute straight-line or invented travel estimates.
export async function durationTable(pts: Pt[]): Promise<{ durations: number[][]; fallback: boolean }> {
  try {
    const url = `${OSRM}/table/v1/driving/${coordStr(pts)}?annotations=duration`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Flow-HacKaTech/1.0" },
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`osrm table ${r.status}`);
    const d = (await r.json()) as { durations: (number | null)[][] };
    if (!Array.isArray(d.durations) || d.durations.some((row) => row.some((seconds) => seconds == null))) {
      throw new Error("osrm table contains an unreachable route");
    }
    return {
      durations: d.durations.map((row) =>
        row.map((sec) => Math.round((sec as number) / 60)),
      ),
      fallback: false,
    };
  } catch {
    return {
      durations: [],
      fallback: true,
    };
  }
}

// real road geometry + per-leg duration/distance for an ordered route.
// Never throws. An unavailable route is represented by empty geometry/legs.
export async function roadRoute(pts: Pt[]): Promise<RouteResult> {
  try {
    const url = `${OSRM}/route/v1/driving/${coordStr(pts)}?overview=full&geometries=geojson&annotations=duration,distance`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Flow-HacKaTech/1.0" },
      signal: AbortSignal.timeout(OSRM_TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`osrm route ${r.status}`);
    const d = (await r.json()) as {
      routes: { geometry: { coordinates: [number, number][] }; legs: { duration: number; distance: number }[] }[];
    };
    const rt = d.routes?.[0];
    if (!rt) throw new Error("osrm no route");
    return {
      geometry: rt.geometry.coordinates,
      legs: rt.legs.map((l) => ({
        durationMin: Math.round(l.duration / 60),
        distanceKm: +(l.distance / 1000).toFixed(1),
      })),
      fallback: false,
    };
  } catch {
    return {
      geometry: [],
      legs: [],
      fallback: true,
    };
  }
}
