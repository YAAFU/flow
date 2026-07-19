import { NextRequest, NextResponse } from "next/server";
import { client, MODEL_FAST, extractJson } from "@/lib/claude";
import { z } from "zod";

export const runtime = "nodejs";

const TAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { tag: { type: "string" } },
  required: ["tag"],
};

const SYSTEM = `คุณคือ Flow ผู้ช่วยตั้งชื่อ "ป้ายวัน" สั้น ๆ จากรายการงานของวันนั้น
- ดูธีมรวมของงานทั้งวันแล้วตั้งเป็นป้ายไทยสั้น กระชับ ไม่เกิน ~16 ตัวอักษร เช่น "วันประชุมหลายที่", "วันส่งงาน", "วันพักผ่อน", "วันวิ่งงานนอก"
- เป็นภาษาคนเป็นกันเอง ไม่ใส่เครื่องหมายคำพูด ไม่ใส่อิโมจิ ไม่ลงท้ายด้วยจุด
- ถ้างานหลากหลายมาก ใช้คำกลาง ๆ เช่น "วันยุ่งหลายงาน"
ตอบเป็น JSON ตาม schema เท่านั้น`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const titles: string[] = Array.isArray(body?.tasks)
    ? body.tasks.map((t: { title?: string; place?: string; priority?: string }) =>
        `${t.title ?? ""}${t.place ? ` @${t.place}` : ""}${t.priority === "high" ? " (สำคัญ)" : ""}`)
    : [];
  if (!titles.length) return NextResponse.json({ tag: "" });
  try {
    const msg = await client().messages.create({
      model: MODEL_FAST,
      max_tokens: 200,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: TAG_SCHEMA } },
      messages: [{ role: "user", content: `งานของวันนี้:\n- ${titles.join("\n- ")}\n\nตั้งป้ายวัน` }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = z.object({ tag: z.string() }).parse(extractJson(out));
    return NextResponse.json({ tag: parsed.tag.trim().slice(0, 24) });
  } catch (e) {
    console.error("[day-tag] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ tag: "" }, { status: 200 });
  }
}
