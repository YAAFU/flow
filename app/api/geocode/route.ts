import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Free geocoding via OpenStreetMap Nominatim (no API key). Server-side so we can
// set a proper User-Agent (per Nominatim usage policy) and bias to Bangkok.
const BKK_VIEWBOX = "100.30,13.95,100.95,13.50"; // lon,lat top-left → bottom-right
const GEOCODE_TIMEOUT_MS = 6_000;

type Hit = { name: string; lat: number; lng: number };

function parseCoordinate(value: unknown) {
  if (value === null || value === undefined || (typeof value === "string" && !value.trim())) return null;
  const coordinate = typeof value === "number" ? value : Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function validCoordinates(latitude: unknown, longitude: unknown) {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);
  return lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

function parseNominatimHits(value: unknown): Hit[] | null {
  if (!Array.isArray(value)) return null;
  const hits: Hit[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const coordinates = validCoordinates(record.lat, record.lon);
    if (!coordinates) continue;
    const displayName = typeof record.display_name === "string" ? record.display_name : "";
    const suppliedName = typeof record.name === "string" ? record.name.trim() : "";
    const name = suppliedName || displayName.split(",")[0]?.trim();
    if (name) hits.push({ name, ...coordinates });
  }
  return hits;
}

async function reverseGeocode(lat: number, lng: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("accept-language", "th");
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Flow-HacKaTech/1.0 (flow city planner demo)" },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
    });
    if (!response.ok) return NextResponse.json({ name: "หมุดที่ปัก", lat, lng });
    const data = (await response.json()) as { name?: string; display_name?: string; address?: Record<string, string> };
    const address = data.address ?? {};
    const name = data.name || address.road || address.suburb || address.neighbourhood || address.quarter || data.display_name?.split(",")[0] || "หมุดที่ปัก";
    return NextResponse.json({ name, lat, lng });
  } catch {
    return NextResponse.json({ name: "หมุดที่ปัก", lat, lng });
  }
}

/** Keep precise coordinates out of the app server request URL. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { latitude?: unknown; longitude?: unknown } | null;
  const coordinates = validCoordinates(body?.latitude, body?.longitude);
  if (!coordinates) return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
  return reverseGeocode(coordinates.lat, coordinates.lng);
}

export async function GET(req: NextRequest) {
  // reverse geocoding: ?lat=..&lng=.. → single place name for a dropped pin
  const latP = req.nextUrl.searchParams.get("lat");
  const lngP = req.nextUrl.searchParams.get("lng");
  if (latP && lngP) {
    const coordinates = validCoordinates(latP, lngP);
    if (!coordinates) {
      return NextResponse.json({ error: "invalid_coordinates" }, { status: 400 });
    }
    return reverseGeocode(coordinates.lat, coordinates.lng);
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([] as Hit[]);

  // Nominatim is strict with long Thai names ("คณะวิศวกรรมศาสตร์ จุฬาลงกรณ์มหาวิทยาลัย"
  // finds nothing, "จุฬาลงกรณ์มหาวิทยาลัย" does) - so when the full query misses,
  // retry with leading/trailing words dropped until something hits
  const toks = q.split(/\s+/).filter(Boolean);
  const candidates = [q];
  for (let i = 1; i < toks.length; i++) candidates.push(toks.slice(i).join(" "));
  for (let i = toks.length - 1; i >= 1; i--) candidates.push(toks.slice(0, i).join(" "));
  for (const cand of [...new Set(candidates)].slice(0, 4)) {
    const hits = await searchNominatim(cand);
    if (hits === null) return NextResponse.json({ error: "geocoding_unavailable" }, { status: 502 });
    if (hits.length) return NextResponse.json(hits);
  }
  return NextResponse.json([] as Hit[]);
}

async function searchNominatim(q: string): Promise<Hit[] | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "th");
  url.searchParams.set("viewbox", BKK_VIEWBOX);
  url.searchParams.set("bounded", "0"); // prefer the box but still allow outside
  url.searchParams.set("accept-language", "th");
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Flow-HacKaTech/1.0 (flow city planner demo)" },
      signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MS),
      // cache identical lookups a bit to be gentle on Nominatim
      next: { revalidate: 3600 },
    });
    if (!r.ok) return null;
    return parseNominatimHits(await r.json());
  } catch {
    return null;
  }
}
