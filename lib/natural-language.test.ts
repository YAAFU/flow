import {describe,expect,it} from "vitest";
import {parseThaiHints} from "@/lib/natural-language";
describe("Thai natural-language hints",()=>{it("extracts relative date, time, duration, reminder and recurrence",()=>{expect(parseThaiHints("พรุ่งนี้ประชุม 10 โมง 1 ชั่วโมง เตือนก่อน 10 นาที ทุกสัปดาห์ ด่วน","2026-07-19")).toMatchObject({date:"2026-07-20",time:"10:00",durationMin:60,reminderOffsets:[10],repeat:"weekly",priority:"urgent"});});});
