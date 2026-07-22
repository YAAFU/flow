import { NextRequest, NextResponse } from "next/server";
import { AI_TIMEOUT_MS, client, MODEL_SMART, extractJson, withTimeout } from "@/lib/claude";
import { DayEnergySchema, IsoDateSchema, PlanResultSchema, TaskSchema, TimeSchema } from "@/lib/types";
import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { buildLocalPlan } from "@/lib/local-planner";
import { lockedTimesFromTasks, normalizePlanningContext, PlanningContextSchema } from "@/lib/planning-context";
import {
  addTravelAccuracyWarning,
  buildPlanningPrompt,
  buildTravelPlanningContext,
  reconcilePlanTravel,
  travelAccuracyWarning,
  unavailableTravelPlanningContext,
  validateLockedPlan,
  type TravelPlanningContext,
} from "@/lib/planning-route";
import { addOverlapWarnings, validatePlanTaskCoverage } from "@/lib/schedule-validation";
import { localDateKey } from "@/lib/time";
import { z } from "zod";

export const runtime = "nodejs";

const RequestSchema = z.object({
  planningContext: PlanningContextSchema.optional(),
  tasks: z.array(TaskSchema).min(1).max(200).optional(),
  selectedDate: IsoDateSchema.optional(),
  energy: DayEnergySchema.optional(),
  timezone: z.string().min(1).max(100).default("Asia/Bangkok"),
  dayStart: TimeSchema.optional(),
  dayEnd: TimeSchema.optional(),
  breakMin: z.number().int().min(0).max(240).optional(),
}).superRefine((value, issueContext) => {
  if (!value.planningContext && !value.tasks) {
    issueContext.addIssue({ code: "custom", path: ["planningContext"], message: "planningContext or legacy tasks is required" });
  }
});

const SYSTEM = `คุณคือ Flow ผู้ช่วยวางแผนวันสำหรับคนในประเทศไทย
หลักคิด: ช่วยให้ผู้ใช้ "รู้สึกคุมเวลาได้" เพื่อลดความเครียด (อ้างอิงงานวิจัยว่าความรู้สึกควบคุมลดความเครียดได้มากกว่าผลงานที่เพิ่มขึ้น)

รับ planningContext แบบ JSON แล้วจัดตาราง 1 วัน โดยแต่ละงานมีฟิลด์:
- title, place (อาจเป็นต่างจังหวัด), priority (urgent/high/normal/flex), deadlineDate/deadlineTime, allDay, categoryId และ reminderOffsets
- fixedTime: ถ้ามี = ผู้ใช้อยากเริ่มประมาณเวลานี้; ถ้าไม่มี = คุณหาเวลาที่เหมาะให้เอง
- lockTime: ถ้า true = ห้ามเลื่อนเวลานี้เด็ดขาด (anchor)
- durationMin: ถ้ามี = ใช้เวลาเท่านี้; ถ้าไม่มี = ประเมินเองตามชนิดงานให้สมจริง (เช่น ตื่นนอน/เตรียมตัว ~30-45น, ประชุม ~60น, กินข้าว ~45น, รับน้อง/กิจกรรม ~60น)

กฎการจัดเวลา:
1. งานที่ lockTime=true หรือ priority=urgent/high ที่มี fixedTime → เป็น anchor ตรึงเวลาไว้ ห้ามเลื่อน
2. งานที่ priority=flex หรือไม่มี fixedTime → เลื่อน/ยืดได้ จัดให้สอดคล้องกับ anchor
3. ใช้เวลาเดินทางเฉพาะจาก travelContext ที่ status=available เท่านั้น ห้ามเดาหรือสร้างเวลาเดินทางเอง
4. ถ้า travelContext ใช้ไม่ได้ ให้ travelFromPrevMin=0 และเตือนตรงไปตรงมาใน riskPoints/summary/tip
5. ใช้ energyLevel เป็นบริบทการจัดความแน่นและช่วงพักเท่านั้น ไม่ตีความเป็นข้อมูลทางการแพทย์

การเติมงาน (สำคัญ): ถ้าจำเป็นต้องมีงานที่ผู้ใช้ไม่ได้ใส่เพื่อให้แผนสมจริง ให้ "เพิ่ม" เป็น schedule item ได้ โดยตั้ง aiAdded=true และ taskId="" — เติม "เฉพาะที่จำเป็นจริง ๆ" เช่น ช่วงเดินทางไกลที่ควรเป็นงานของตัวเอง, เตรียมตัว/เดินทางไปสนามบิน, มื้ออาหารถ้าตารางยาวข้ามมื้อ. ห้ามเติมพร่ำเพรื่อ. งานของผู้ใช้ตั้ง aiAdded=false และคง taskId เดิม

สร้าง 2 แผน:
- A = เร็วสุด (กระชับ buffer น้อย) → controlScore ต่ำกว่า, riskScore สูงกว่า
- B = เครียดน้อยสุด (buffer มากขึ้น) → controlScore สูงกว่า, riskScore ต่ำกว่า; B ต้อง controlScore สูงกว่า A เสมอ
แต่ละแผนมี controlScore (0-100) freeTimeMin riskScore (0-100) riskPoints ของตัวเอง
summary + tip ภาษาไทยเป็นกันเอง เปรียบเทียบ 2 แผน; เรียก "แผนเร็วสุด"/"แผนเครียดน้อยสุด" เท่านั้น (ห้ามเรียก A/B)
ตอบกลับเป็น JSON ตาม schema เท่านั้น ห้ามมีข้อความอื่นนอก JSON`;

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
  const request = RequestSchema.safeParse(body);
  if (!request.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const legacyTasks = request.data.tasks ?? [];
  const context = request.data.planningContext
    ? normalizePlanningContext(request.data.planningContext)
    : normalizePlanningContext({
      date: request.data.selectedDate ?? localDateKey(),
      timezone: request.data.timezone,
      energyLevel: request.data.energy ?? "medium",
      tasks: legacyTasks,
      lockedTimes: lockedTimesFromTasks(legacyTasks),
    });
  const tasks = context.tasks;
  const constraints = { dayStart: request.data.dayStart, dayEnd: request.data.dayEnd, breakMin: request.data.breakMin };
  let travelContext: TravelPlanningContext;
  try {
    travelContext = await withTimeout(buildTravelPlanningContext(context), 6_000, "travel matrix");
  } catch {
    travelContext = unavailableTravelPlanningContext(context);
  }
  const localOptions = { ...constraints, energyLevel: context.energyLevel, startLocation: context.startLocation, travelContext };
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json(buildLocalPlan(tasks, localOptions));
  try {
    const msg = await withTimeout(client().messages.create({
      model: MODEL_SMART,
      max_tokens: 8000,
      system: SYSTEM,
      // structured outputs: guaranteed-valid JSON matching PLAN_SCHEMA
      output_config: { format: { type: "json_schema", schema: PLAN_SCHEMA } },
      messages: [{ role: "user", content: buildPlanningPrompt(context, travelContext, constraints) }],
    }), AI_TIMEOUT_MS, "plan");
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    if (msg.stop_reason === "max_tokens") console.warn("[plan] response hit max_tokens (truncated JSON)");
    let parsed = PlanResultSchema.parse({ ...(extractJson(text) as object), mode: "ai" });
    const coverageIssues = validatePlanTaskCoverage(parsed, tasks);
    if (coverageIssues.length) throw new Error(`plan task coverage invalid: ${coverageIssues.join(",")}`);
    const lockedIssues = validateLockedPlan(parsed, context);
    if (lockedIssues.length) throw new Error(`plan locked time invalid: ${lockedIssues.join(",")}`);
    parsed = reconcilePlanTravel(parsed, travelContext, constraints);
    parsed = addOverlapWarnings(parsed);
    parsed = addTravelAccuracyWarning(parsed, travelAccuracyWarning(context, travelContext));
    // override the model's scores with the deterministic formula so the
    // numbers users see are explainable (matches the breakdown in ScoreCard)
    for (const k of ["A", "B"] as const) {
      const v = parsed.plans[k];
      v.controlScore = controlBreakdown(v.schedule, v.riskPoints).score;
      v.freeTimeMin = freeTimeMin(v.schedule);
    }
    return NextResponse.json(parsed);
  } catch (e) {
    console.warn("[plan] local fallback:", e instanceof Error ? e.message : e);
    return NextResponse.json(buildLocalPlan(tasks, localOptions));
  }
}
