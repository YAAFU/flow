import { NextRequest, NextResponse } from "next/server";
import { durationTable, roadRoute, type Pt } from "@/lib/osrm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pts: Pt[] = Array.isArray(body?.coords) ? body.coords : [];
  const mode: string = body?.mode === "route" ? "route" : "table";
  const valid = pts.filter((p) => typeof p?.lat === "number" && typeof p?.lng === "number");
  if (valid.length < 2) return NextResponse.json({ error: "need >=2 coords" }, { status: 400 });
  if (mode === "route") return NextResponse.json(await roadRoute(valid));
  return NextResponse.json(await durationTable(valid));
}
