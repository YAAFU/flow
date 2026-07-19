import { NextRequest, NextResponse } from "next/server";
import { client, MODEL_SMART, extractJson } from "@/lib/claude";
import { PlanResultSchema, TaskSchema, type Task } from "@/lib/types";
import { FALLBACK_PLAN } from "@/lib/fixtures";
import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { durationTable } from "@/lib/osrm";
import { z } from "zod";

export const runtime = "nodejs";

const SYSTEM = `คุณคือ Flow ผู้ช่วยวางแผนวันสำหรับคนในประเทศไทย
หลักคิด: ช่วยให้ผู้ใช้ "รู้สึกคุมเวลาได้" เพื่อลดความเครียด (อ้างอิงงานวิจัยว่าความรู้สึกควบคุมลดความเครียดได้มากกว่าผลงานที่เพิ่มขึ้น)

รับ list งาน แล้วจัดตาราง 1 วัน โดยแต่ละงานมีฟิลด์:
- title, place (อาจเป็นต่างจังหวัด), priority (urgent/high/normal/flex), deadlineDate/deadlineTime, allDay, categoryId และ reminderOffsets
- fixedTime: ถ้ามี = ผู้ใช้อยากเริ่มประมาณเวลานี้; ถ้าไม่มี = คุณหาเวลาที่เหมาะให้เอง
- lockTime: ถ้า true = ห้ามเลื่อนเวลานี้เด็ดขาด (anchor)
- durationMin: ถ้ามี = ใช้เวลาเท่านี้; ถ้าไม่มี = ประเมินเองตามชนิดงานให้สมจริง (เช่น ตื่นนอน/เตรียมตัว ~30-45น, ประชุม ~60น, กินข้าว ~45น, รับน้อง/กิจกรรม ~60น)

กฎการจัดเวลา:
1. งานที่ lockTime=true หรือ priority=urgent/high ที่มี fixedTime → เป็น anchor ตรึงเวลาไว้ ห้ามเลื่อน
2. งานที่ priority=flex หรือไม่มี fixedTime → เลื่อน/ยืดได้ จัดให้สอดคล้องกับ anchor
3. คำนวณเวลาเดินทางจริงระหว่างสถานที่ (ในเมืองเผื่อรถติด; ข้ามจังหวัดใช้เวลาจริงเป็นชั่วโมง เช่น กรุงเทพ-มุกดาหาร ขับ ~9-10 ชม.) ใส่เป็น travelFromPrevMin ของงานถัดไป
4. ถ้าตารางเป็นไปไม่ได้จริง (เช่น เวลาเดินทางไกลกว่าที่มี) อย่าฝืนจัดให้ดูทัน— ให้สะท้อนความจริงใน riskPoints และเตือนใน summary/tip (เช่น ต้องออกก่อนหน้า/ค้างคืน/นั่งเครื่องบิน)

การเติมงาน (สำคัญ): ถ้าจำเป็นต้องมีงานที่ผู้ใช้ไม่ได้ใส่เพื่อให้แผนสมจริง ให้ "เพิ่ม" เป็น schedule item ได้ โดยตั้ง aiAdded=true และ taskId="" — เติม "เฉพาะที่จำเป็นจริง ๆ" เช่น ช่วงเดินทางไกลที่ควรเป็นงานของตัวเอง, เตรียมตัว/เดินทางไปสนามบิน, มื้ออาหารถ้าตารางยาวข้ามมื้อ. ห้ามเติมพร่ำเพรื่อ. งานของผู้ใช้ตั้ง aiAdded=false และคง taskId เดิม

สร้าง 2 แผน:
- A = เร็วสุด (กระชับ buffer น้อย) → controlScore ต่ำกว่า, riskScore สูงกว่า
- B = เครียดน้อยสุด (buffer มากขึ้น) → controlScore สูงกว่า, riskScore ต่ำกว่า; B ต้อง controlScore สูงกว่า A เสมอ
แต่ละแผนมี controlScore (0-100) freeTimeMin riskScore (0-100) riskPoints ของตัวเอง
summary + tip ภาษาไทยเป็นกันเอง เปรียบเทียบ 2 แผน; เรียก "แผนเร็วสุด"/"แผนเครียดน้อยสุด" เท่านั้น (ห้ามเรียก A/B)
ตอบกลับเป็น JSON ตาม schema เท่านั้น ห้ามมีข้อความอื่นนอก JSON`;

function userPrompt(tasks: Task[], travelBlock: string) {
  return `งานวันนี้ (JSON; fixedTime/durationMin ที่เป็น null คือยังไม่ระบุ ให้คุณจัด/ประเมินเอง): ${JSON.stringify(tasks)}
${travelBlock}
จัดตารางทั้ง 2 แผน (A=เร็วสุด, B=เครียดน้อยสุด): ประเมิน duration ที่ขาด, ตรึง anchor, เลื่อนงานที่ยืดได้, เติมงานที่จำเป็น (aiAdded=true) และเตือนถ้าตารางไม่สมจริง พร้อมจุดเสี่ยง คะแนนคุมเวลา สรุป และทิป`;
}

// Build a real driving-time matrix (minutes, OSRM + Bangkok traffic factor)
// between the tasks' marked locations so Claude plans with true travel times.
async function travelMatrix(tasks: Task[]): Promise<string> {
  const located = tasks.filter((t) => t.lat != null && t.lng != null);
  if (located.length < 2) return "";
  const { durations } = await durationTable(located.map((t) => ({ lat: t.lat!, lng: t.lng! })));
  const labels = located.map((t, i) => `[${i}] ${t.title} @ ${t.place}`);
  const rows = located.map((_, i) =>
    located.map((_, j) => `${i}->${j}:${durations[i]?.[j] ?? "?"}น`).join("  "),
  );
  return `\nเวลาเดินทางขับรถจริง (นาที รวมรถติด กทม.) ระหว่างสถานที่:\n${labels.join("\n")}\nเมทริกซ์:\n${rows.join("\n")}\nใช้ตัวเลขนี้เป็น travelFromPrevMin ตามลำดับที่จัด ห้ามเดาเอง\n`;
}

// JSON Schema for structured outputs - forces the API to return valid,
// schema-conformant JSON so the model can never produce malformed JSON
// (e.g. unescaped quotes inside Thai strings, which broke text parsing before).
const SCHED = {
  type: "object",
  additionalProperties: false,
  properties: {
    taskId: { type: "string" },
    title: { type: "string" },
    placeLabel: { type: "string" },
    start: { type: "string" },
    end: { type: "string" },
    travelFromPrevMin: { type: "number" },
    aiAdded: { type: "boolean" },
  },
  required: ["taskId", "title", "placeLabel", "start", "end", "travelFromPrevMin", "aiAdded"],
};
const RISK = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: { time: { type: "string" }, reason: { type: "string" } },
    required: ["time", "reason"],
  },
};
const VARIANT = {
  type: "object",
  additionalProperties: false,
  properties: {
    schedule: { type: "array", items: SCHED },
    controlScore: { type: "number" },
    freeTimeMin: { type: "number" },
    riskScore: { type: "number" },
    riskPoints: RISK,
  },
  required: ["schedule", "controlScore", "freeTimeMin", "riskScore", "riskPoints"],
};
const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    plans: {
      type: "object",
      additionalProperties: false,
      properties: { A: VARIANT, B: VARIANT },
      required: ["A", "B"],
    },
    summary: { type: "string" },
    tip: { type: "string" },
  },
  required: ["plans", "summary", "tip"],
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tasks = z.array(TaskSchema).safeParse(body?.tasks);
  if (!tasks.success) return NextResponse.json({ error: "invalid tasks" }, { status: 400 });
  try {
    const travelBlock = await travelMatrix(tasks.data);
    const msg = await client().messages.create({
      model: MODEL_SMART,
      max_tokens: 8000,
      system: SYSTEM,
      // structured outputs: guaranteed-valid JSON matching PLAN_SCHEMA
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
      messages: [{ role: "user", content: userPrompt(tasks.data, travelBlock) }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (msg.stop_reason === "max_tokens") console.error("[plan] response hit max_tokens (truncated JSON)");
    const parsed = PlanResultSchema.parse(extractJson(text));
    // override the model's scores with the deterministic formula so the
    // numbers users see are explainable (matches the breakdown in ScoreCard)
    for (const k of ["A", "B"] as const) {
      const v = parsed.plans[k];
      v.controlScore = controlBreakdown(v.schedule, v.riskPoints).score;
      v.freeTimeMin = freeTimeMin(v.schedule);
    }
    return NextResponse.json(parsed);
  } catch (e) {
    // demo must survive: fall back to fixture - but log WHY so we can fix it
    console.error("[plan] falling back:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ...FALLBACK_PLAN, _fallback: true });
  }
}
