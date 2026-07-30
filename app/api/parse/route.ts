import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AiScheduleParser } from "@/lib/schedule-parser/ai.server";
import { LocalScheduleParser } from "@/lib/schedule-parser/local";
import { ScheduleParserRequestSchema } from "@/lib/schedule-parser/schema";
import { scheduleToParsedTasks } from "@/lib/ai-parse";

export const runtime = "nodejs";

const RequestSchema = z.object({
  text: z.string().trim().min(3).max(4_000),
  nowIso: z.string().datetime(),
  timezone: z.literal("Asia/Bangkok"),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function POST(request: NextRequest) {
  const body = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const parseRequest = ScheduleParserRequestSchema.parse({
    text: body.data.text,
    referenceDate: body.data.selectedDate,
    timezone: body.data.timezone,
    locale: "th-TH",
  });
  const local = new LocalScheduleParser();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(scheduleToParsedTasks(await local.parse(parseRequest)));
  }

  try {
    const schedule = await new AiScheduleParser().parse(parseRequest);
    return NextResponse.json(scheduleToParsedTasks(schedule));
  } catch {
    const fallback = await local.parse(parseRequest);
    return NextResponse.json(scheduleToParsedTasks({
      ...fallback,
      warnings: ["ไม่สามารถเชื่อมต่อระบบวิเคราะห์ข้อความได้ จึงใช้ตัวแยกข้อความภายในแทน", ...fallback.warnings],
    }));
  }
}
