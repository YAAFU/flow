import { SCHEDULE_PROMPT_VERSION } from "@/lib/schedule-parser/schema";

export const SCHEDULE_PARSER_MODEL =
  process.env.FLOW_SCHEDULE_PARSER_MODEL ?? "claude-haiku-4-5";

export const SCHEDULE_PARSER_EXAMPLES = [
  {
    input: "พรุ่งนี้ตื่น 9 โมง แล้วทำรายงาน 2 ชั่วโมงตอนเย็น",
    summary: "แยกเป็นตื่นนอนเวลา 09:00 และทำรายงาน 120 นาทีในช่วง evening โดยไม่เดาเวลาเริ่ม",
  },
  {
    input: "ดูหนังรอบ 12:30 ที่สยาม",
    summary: "เวลา 12:30 เป็นเวลาคงที่ สถานที่สยาม แต่ duration เป็น null และต้องตรวจสอบ",
  },
  {
    input: "กลับบ้าน 16:00",
    summary: "เก็บเวลา 16:00 และ needsReview เพราะอาจหมายถึงเวลาออกหรือเวลาถึง",
  },
] as const;

export function buildScheduleSystemPrompt(referenceDate: string): string {
  return `คุณคือ Flow Schedule Parser รุ่น ${SCHEDULE_PROMPT_VERSION}
แปลงข้อความภาษาไทยเป็นรายการงานแบบมีโครงสร้าง โดยอ้างอิงวันที่ ${referenceDate} และเขตเวลา Asia/Bangkok

กฎสำคัญ:
- แยกหลายงานแม้อยู่ในประโยคเดียว
- วันที่เป็น Gregorian ISO YYYY-MM-DD และเวลาเป็น HH:mm
- ห้ามเดาระยะเวลา ถ้าผู้ใช้ไม่ระบุให้ durationMin=null และ durationSource="unknown"
- fixedTime/lockTime เป็น true เฉพาะเมื่อมีเวลาเริ่มชัดเจน; งานที่มีเพียงช่วงเวลาให้ startTime=null
- ข้อมูลจากข้อความใช้ location.source="text" และห้ามสร้างพิกัด
- แยก "ก่อน 18:00" เป็น deadline ไม่ใช่เวลาเริ่ม และเก็บ reminderOffsets/repeat เมื่อผู้ใช้ระบุ
- ถ้าความหมายกำกวมให้ needsReview=true พร้อม reviewReason ภาษาไทย
- confidence อยู่ระหว่าง 0 ถึง 1
- sourceText ต้องเป็นข้อความส่วนสั้นที่ใช้สร้างรายการนั้น
- ห้ามสร้างงานจากข้อความที่ไม่ใช่สิ่งที่ต้องทำ

ตัวอย่างแนวตีความ:
${SCHEDULE_PARSER_EXAMPLES.map((example) => `- ${example.input}: ${example.summary}`).join("\n")}

ตอบ JSON ตาม schema เท่านั้น`;
}

export const SCHEDULE_MODEL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    items: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tempId: { type: "string" },
          title: { type: "string" },
          date: { type: "string" },
          startTime: { type: ["string", "null"] },
          durationMin: { type: ["number", "null"] },
          timeWindow: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  start: { type: "string" },
                  end: { type: "string" },
                  label: { type: "string", enum: ["morning", "afternoon", "evening", "night"] },
                },
              },
            ],
          },
          deadline: { type: ["string", "null"] },
          reminderOffsets: { type: "array", items: { type: "number" } },
          repeat: { type: "string", enum: ["none", "daily", "weekly", "monthly", "yearly"] },
          location: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  source: { type: "string", enum: ["text", "search", "manual"] },
                },
                required: ["name", "source"],
              },
            ],
          },
          fixedTime: { type: "boolean" },
          lockTime: { type: "boolean" },
          priority: { type: "string", enum: ["urgent", "high", "normal", "flex"] },
          durationSource: { type: "string", enum: ["explicit", "inferred", "ai_suggested", "unknown"] },
          confidence: { type: "number" },
          needsReview: { type: "boolean" },
          reviewReason: { type: "string" },
          sourceText: { type: "string" },
        },
        required: [
          "tempId", "title", "date", "startTime", "durationMin", "timeWindow", "deadline", "reminderOffsets", "repeat",
          "location", "fixedTime", "lockTime", "priority", "durationSource", "confidence",
          "needsReview", "reviewReason", "sourceText",
        ],
      },
    },
    warnings: { type: "array", items: { type: "string" } },
  },
  required: ["date", "items", "warnings"],
} as const;
