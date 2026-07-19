export interface ParsedHints { date?:string; time?:string; durationMin?:number; reminderOffsets:number[]; priority?:"urgent"|"high"|"normal"|"flex"; repeat?:"daily"|"weekly"|"monthly"|"yearly"; allDay:boolean; }
export function parseThaiHints(text:string,selectedDate:string):ParsedHints{
  const result:ParsedHints={reminderOffsets:[],allDay:/ทั้งวัน/.test(text)};
  const base=new Date(`${selectedDate}T12:00:00`);if(/พรุ่งนี้/.test(text)){base.setDate(base.getDate()+1);result.date=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,"0")}-${String(base.getDate()).padStart(2,"0")}`;}else if(/วันนี้/.test(text))result.date=selectedDate;
  const clock=text.match(/(?:เวลา\s*)?(\d{1,2})(?::(\d{2}))?\s*(?:น\.|โมง)/);if(clock)result.time=`${clock[1].padStart(2,"0")}:${clock[2]??"00"}`;
  const duration=text.match(/(\d+)\s*(ชั่วโมง|ชม\.|นาที)/);if(duration)result.durationMin=Number(duration[1])*(duration[2].startsWith("ช")?60:1);
  const reminder=text.match(/เตือน(?:ก่อน)?\s*(\d+)\s*(ชั่วโมง|นาที)/);if(reminder)result.reminderOffsets=[Number(reminder[1])*(reminder[2]==="ชั่วโมง"?60:1)];
  if(/ด่วนที่สุด|ด่วน/.test(text))result.priority="urgent";else if(/สำคัญ/.test(text))result.priority="high";else if(/ยืดหยุ่น|ว่างเมื่อไร/.test(text))result.priority="flex";
  if(/ทุกวัน/.test(text))result.repeat="daily";else if(/ทุกสัปดาห์|ทุกอาทิตย์/.test(text))result.repeat="weekly";else if(/ทุกเดือน/.test(text))result.repeat="monthly";else if(/ทุกปี/.test(text))result.repeat="yearly";
  return result;
}
