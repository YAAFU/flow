import { NextRequest, NextResponse } from "next/server";
import { client, MODEL_SMART } from "@/lib/claude";
import { SlotSuggestionSchema } from "@/lib/types";
import { FALLBACK_SLOTS } from "@/lib/fixtures";
import { z } from "zod";

export const runtime = "nodejs";

function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in model output");
  return JSON.parse(text.slice(start, end + 1));
}

// structured-output schema (root must be an object) → { slots: [...] }
const SLOTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
          reason: { type: "string" },
          resultingControlScore: { type: "number" },
        },
        required: ["date", "start", "end", "reason", "resultingControlScore"],
      },
    },
  },
  required: ["slots"],
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const newTask = body?.newTask; const monthLoad = body?.monthLoad ?? {};
  if (!newTask?.title || !newTask?.durationMin) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const system = `คุณคือ Flow ช่วยหาช่องเวลาลงงานใหม่ในเดือน มิ.ย. 2026 โดยเลี่ยงวันที่แน่นอยู่แล้ว เลือกวันที่ผู้ใช้จะเครียดน้อยสุดและคุมเวลาได้ดีสุด พิจารณาความสำคัญ (priority) และสถานที่ของงานด้วย - งานสำคัญควรได้ช่วงเวลาสมองสด, งานที่ยืดได้ลงวันที่ว่างกว่า`;
  const prompt = `งานใหม่: ${JSON.stringify(newTask)} (มี title, durationMin, place, priority)
ภาระต่อวัน (วันที่→0..1 ยิ่งสูงยิ่งแน่น): ${JSON.stringify(monthLoad)}
แนะนำ 2-3 ช่องเวลาที่เหมาะที่สุด พร้อมเหตุผลที่อ้างอิงความสำคัญ/สถานที่
resultingControlScore = คะแนนคุมเวลา 0-100 (จำนวนเต็ม เช่น 88) ไม่ใช่ 0-1`;
  try {
    const msg = await client().messages.create({
      model: MODEL_SMART,
      max_tokens: 3000,
      system,
      output_config: { format: { type: "json_schema", schema: SLOTS_SCHEMA } },
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map(b => (b.type === "text" ? b.text : "")).join("");
    const obj = extractJson(text) as { slots?: unknown };
    const arr = z.array(SlotSuggestionSchema).parse(obj.slots);
    return NextResponse.json(arr);
  } catch (e) {
    console.error("[smart-slot] falling back:", e instanceof Error ? e.message : e);
    return NextResponse.json(FALLBACK_SLOTS);
  }
}
