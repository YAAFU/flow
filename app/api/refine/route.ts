import { NextRequest, NextResponse } from "next/server";
import { client, MODEL_SMART, extractJson } from "@/lib/claude";
import { z } from "zod";

export const runtime = "nodejs";

const SYSTEM = `คุณคือ Flow ผู้ช่วยปรับแผนวันแบบสนทนา (ภาษาไทยเป็นกันเอง)
คุณได้รับ "งานปัจจุบัน" (JSON) + บทสนทนากับผู้ใช้ หน้าที่คุณ:
- ถ้าข้อมูลยังไม่พอจะจัดแผนได้ดี (เช่น ไปต่างจังหวัดแต่ไม่รู้ว่าไปยังไง มีรถเองไหม ค้างคืนไหม ต้องถึงกี่โมง) → ถามกลับสั้น ๆ ทีละ 1-2 คำถาม ตั้ง hasUpdate=false และ tasks=[]
- ถ้าผู้ใช้ให้ข้อมูลพอแล้ว หรือสั่งให้ปรับ/เพิ่ม/ลบงาน → คืนรายการงานที่อัปเดต ตั้ง hasUpdate=true พร้อม reply อธิบายสั้น ๆ ว่าปรับอะไร

กติกาการคืนงาน (เมื่อ hasUpdate=true):
- คืน "ทั้งรายการ" ที่ควรเป็น (ไม่ใช่เฉพาะที่เปลี่ยน)
- แต่ละงาน: title, place (ถ้าไม่รู้ใส่ ""), fixedTime ("HH:MM" ถ้าควรตรึงเวลา ไม่งั้น ""), durationMin (นาที ถ้าไม่แน่ใจประเมินให้, 0 = ให้ระบบจัดเอง), lockTime (true ถ้าห้ามเลื่อน), priority (urgent/high/normal/flex), aiAdded (true ถ้าคุณเป็นคนเพิ่มงานนี้เอง เช่น เดินทาง/เตรียมตัว/มื้ออาหาร)
- เติมงานที่จำเป็นจริง ๆ เท่านั้น (เช่น ช่วงเดินทางไกล, ไปสนามบิน, มื้ออาหารถ้าตารางข้ามมื้อ) อย่าเติมพร่ำเพรื่อ
ตอบเป็น JSON ตาม schema เท่านั้น`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    hasUpdate: { type: "boolean" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          place: { type: "string" },
          fixedTime: { type: "string" },
          durationMin: { type: "number" },
          lockTime: { type: "boolean" },
          priority: { type: "string", enum: ["high", "normal", "flex"] },
          aiAdded: { type: "boolean" },
        },
        required: ["title", "place", "fixedTime", "durationMin", "lockTime", "priority", "aiAdded"],
      },
    },
  },
  required: ["reply", "hasUpdate", "tasks"],
};

const OutSchema = z.object({
  reply: z.string(),
  hasUpdate: z.boolean(),
  tasks: z.array(z.object({
    title: z.string(), place: z.string(), fixedTime: z.string(), durationMin: z.number(),
    lockTime: z.boolean(), priority: z.enum(["high", "normal", "flex"]), aiAdded: z.boolean(),
  })),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tasks = Array.isArray(body?.tasks) ? body.tasks : [];
  const history = Array.isArray(body?.messages) ? body.messages : [];
  const convo = history.map((m: { role: string; content: string }) => `${m.role === "user" ? "ผู้ใช้" : "Flow"}: ${m.content}`).join("\n");
  try {
    const msg = await client().messages.create({
      model: MODEL_SMART,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: `งานปัจจุบัน (JSON): ${JSON.stringify(tasks)}\n\nบทสนทนา:\n${convo}\n\nตอบต่อ` }],
    });
    const out = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return NextResponse.json(OutSchema.parse(extractJson(out)));
  } catch (e) {
    console.error("[refine] failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ reply: "ขอโทษ ตอนนี้ปรับให้ไม่ได้ ลองใหม่อีกครั้งนะ", hasUpdate: false, tasks: [] }, { status: 200 });
  }
}
