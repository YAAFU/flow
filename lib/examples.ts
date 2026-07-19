import type { Task } from "./types";
import { BKK_PLACES } from "./places";

const p = (name: string) => ({ place: name, lat: BKK_PLACES[name]?.lat, lng: BKK_PLACES[name]?.lng });

export type ExampleSet = { id: string; label: string; hint: string; tasks: Task[] };

export const EXAMPLE_SETS: ExampleSet[] = [
  {
    id: "office",
    label: "วันทำงานออฟฟิศ",
    hint: "ออฟฟิศ + กลับบ้าน + ทำงานต่อดึก",
    tasks: [
      { id: "o1", title: "ทำงานออฟฟิศ", ...p("สยาม"), durationMin: 150, fixedTime: "12:00", priority: "high" },
      { id: "o2", title: "กลับไปคุยกับน้อง", ...p("บ้าน"), durationMin: 60, fixedTime: "20:00", priority: "normal" },
      { id: "o3", title: "กลับไปทำงานต่อ", ...p("สยาม"), durationMin: 180, fixedTime: "00:00", priority: "high" },
    ],
  },
  {
    id: "meetings",
    label: "วันประชุมหลายที่",
    hint: "วิ่งประชุม 3 ย่าน",
    tasks: [
      { id: "m1", title: "ประชุมลูกค้า A", ...p("สีลม"), durationMin: 90, fixedTime: "10:00", priority: "high" },
      { id: "m2", title: "กินข้าวกับทีม", ...p("อโศก"), durationMin: 60, fixedTime: "12:30", priority: "normal" },
      { id: "m3", title: "พรีเซนต์งาน", ...p("สยาม"), durationMin: 90, fixedTime: "15:00", priority: "high" },
      { id: "m4", title: "ดินเนอร์พาร์ทเนอร์", ...p("ทองหล่อ"), durationMin: 120, fixedTime: "19:00", priority: "normal" },
    ],
  },
  {
    id: "freelance",
    label: "ฟรีแลนซ์หลายงาน",
    hint: "คาเฟ่ทำงาน + ส่งงาน + เรียนคอร์ส",
    tasks: [
      { id: "f1", title: "นั่งคาเฟ่ทำงานลูกค้า", ...p("อารีย์"), durationMin: 180, fixedTime: "09:00", priority: "high" },
      { id: "f2", title: "ส่งงานที่ออฟฟิศลูกค้า", ...p("จตุจักร"), durationMin: 45, fixedTime: "13:00", priority: "high" },
      { id: "f3", title: "เรียนคอร์สออนไลน์ที่บ้าน", ...p("บ้าน"), durationMin: 90, fixedTime: "16:00", priority: "flex" },
      { id: "f4", title: "เจอเพื่อนนักออกแบบ", ...p("ทองหล่อ"), durationMin: 120, fixedTime: "19:30", priority: "normal" },
    ],
  },
];
