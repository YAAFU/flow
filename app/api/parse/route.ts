import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { client, extractJson, MODEL_FAST } from "@/lib/claude";
import { PrioritySchema } from "@/lib/types";

export const runtime = "nodejs";

const RequestSchema=z.object({text:z.string().min(3).max(4000),nowIso:z.string().datetime(),timezone:z.literal("Asia/Bangkok"),selectedDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
const ParsedTaskSchema=z.object({title:z.string().min(1),place:z.string(),durationMin:z.number().int().min(15),fixedTime:z.string(),allDay:z.boolean(),deadlineDate:z.string(),deadlineTime:z.string(),priority:PrioritySchema,categoryName:z.string(),reminderOffsets:z.array(z.number().int().min(0)),repeat:z.enum(["none","daily","weekly","monthly","yearly"]),needsReview:z.boolean(),note:z.string()});
const RESPONSE_SCHEMA={type:"object",additionalProperties:false,properties:{tasks:{type:"array",items:{type:"object",additionalProperties:false,properties:{title:{type:"string"},place:{type:"string"},durationMin:{type:"number"},fixedTime:{type:"string"},allDay:{type:"boolean"},deadlineDate:{type:"string"},deadlineTime:{type:"string"},priority:{type:"string",enum:["urgent","high","normal","flex"]},categoryName:{type:"string"},reminderOffsets:{type:"array",items:{type:"number"}},repeat:{type:"string",enum:["none","daily","weekly","monthly","yearly"]},needsReview:{type:"boolean"},note:{type:"string"}},required:["title","place","durationMin","fixedTime","allDay","deadlineDate","deadlineTime","priority","categoryName","reminderOffsets","repeat","needsReview","note"]}}},required:["tasks"]};

export async function POST(request:NextRequest){
  const body=RequestSchema.safeParse(await request.json().catch(()=>null));
  if(!body.success)return NextResponse.json({error:"invalid_request"},{status:400});
  if(!process.env.ANTHROPIC_API_KEY)return NextResponse.json({error:"ai_not_configured",message:"ยังไม่ได้เชื่อมต่อ Anthropic"},{status:503});
  const {text,nowIso,timezone,selectedDate}=body.data;
  const system=`คุณคือ Flow ผู้ช่วยแปลงภาษาไทยเป็นงานแบบมีโครงสร้าง ใช้เวลาท้องถิ่น ${timezone} วันนี้ตามระบบคือ ${nowIso} และวันที่ผู้ใช้กำลังดูคือ ${selectedDate}
อ่านข้อความแล้วแยกวันที่ เวลาเริ่ม ระยะเวลา เส้นตาย priority (urgent/high/normal/flex) หมวดหมู่ reminder การทำซ้ำ สถานที่ และ all-day
fixedTime/deadlineDate/deadlineTime/categoryName/place ใช้สตริงว่างเมื่อไม่พบ ระยะเวลาเริ่มต้น 60 นาที
ถ้าข้อมูลสำคัญกำกวมให้ needsReview=true และเขียน note ภาษาไทย ห้ามเดาข้อมูลส่วนบุคคล ตอบ JSON ตาม schema เท่านั้น`;
  try{
    const message=await client().messages.create({model:MODEL_FAST,max_tokens:4000,system,output_config:{format:{type:"json_schema",schema:RESPONSE_SCHEMA}},messages:[{role:"user",content:text}]});
    const output=message.content.map(block=>block.type==="text"?block.text:"").join("");
    return NextResponse.json(z.object({tasks:z.array(ParsedTaskSchema)}).parse(extractJson(output)));
  }catch(error){console.error("[parse] failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"parse_failed"},{status:502});}
}
