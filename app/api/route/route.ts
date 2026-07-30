import { NextRequest, NextResponse } from "next/server";
import { durationTable, roadRoute, type Pt } from "@/lib/osrm";

export const runtime = "nodejs";

function isValidPoint(value: unknown): value is Pt {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Partial<Pt>;
  return typeof lat === "number"
    && typeof lng === "number"
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { coords?: unknown; mode?: unknown } | null;
  const pts = Array.isArray(body?.coords) ? body.coords : [];
  const mode = body?.mode === "route" ? "route" : "table";
  const valid = pts.filter(isValidPoint);
  if (valid.length < 2) return NextResponse.json({ error: "need >=2 coords" }, { status: 400 });
  if (mode === "route") return NextResponse.json(await roadRoute(valid));
  return NextResponse.json(await durationTable(valid));
}
