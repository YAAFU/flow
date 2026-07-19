import type { PlanResult, Task, SlotSuggestion } from "./types";

export const DEMO_TASKS: Task[] = [
  { id: "t1", title: "ทำงานออฟฟิศ", place: "สยาม", durationMin: 150, fixedTime: "12:00", priority: "high" },
  { id: "t2", title: "กลับไปคุยกับน้อง", place: "บ้าน", durationMin: 60, fixedTime: "20:00", priority: "normal" },
  { id: "t3", title: "กลับไปทำงานต่อ", place: "สยาม", durationMin: 180, fixedTime: "00:00", priority: "high" },
];

export const FALLBACK_PLAN: PlanResult = {
  plans: {
    B: {
      schedule: [
        { taskId: "t1", title: "ทำงานออฟฟิศ", placeLabel: "สยาม", start: "12:00", end: "14:30", travelFromPrevMin: 0 },
        { taskId: "t2", title: "กลับไปคุยกับน้อง", placeLabel: "บ้าน", start: "19:00", end: "20:00", travelFromPrevMin: 35 },
        { taskId: "t3", title: "กลับไปทำงานต่อ", placeLabel: "สยาม", start: "00:00", end: "03:00", travelFromPrevMin: 30 },
      ],
      // scores match controlBreakdown(): -7 (1 risk) -1 (travel 65min) = 92
      controlScore: 92, freeTimeMin: 505, riskScore: 28,
      riskPoints: [{ time: "21:00–00:00", reason: "ช่วงดึกยังยาว เผื่องีบสั้น ๆ ก่อนได้" }],
    },
    A: {
      schedule: [
        { taskId: "t1", title: "ทำงานออฟฟิศ", placeLabel: "สยาม", start: "12:00", end: "14:30", travelFromPrevMin: 0 },
        { taskId: "t2", title: "กลับไปคุยกับน้อง", placeLabel: "บ้าน", start: "20:00", end: "21:00", travelFromPrevMin: 35 },
        { taskId: "t3", title: "กลับไปทำงานต่อ", placeLabel: "สยาม", start: "00:00", end: "03:00", travelFromPrevMin: 30 },
      ],
      // -14 (2 risks) -1 (travel) = 85
      controlScore: 85, freeTimeMin: 505, riskScore: 45,
      riskPoints: [
        { time: "21:00–00:00", reason: "ช่วงดึกแน่นเกิน เสี่ยงล้า แนะนำเลื่อนคุยน้องเป็น 19:00" },
        { time: "19:30", reason: "เดินทางกลับช่วงเย็นรถติด ไม่มี buffer เผื่อ" },
      ],
    },
  },
  summary: "วันนี้คุมได้ดี งานหลักลงตัว แผนเครียดน้อยสุดเลื่อนคุยน้องมา 19:00 เลยมีจุดเสี่ยงน้อยกว่าแผนเร็วสุด",
  tip: "ช่วง 14:30–19:00 ว่างยาว พักจริงจังสักชั่วโมงก่อนกลับบ้านได้เลย",
};

export const FALLBACK_SLOTS: SlotSuggestion[] = [
  { date: "2026-06-10", start: "10:00", end: "12:00", reason: "วันว่างสุดในสัปดาห์ ช่วงเช้าสมองสด", resultingControlScore: 84 },
  { date: "2026-06-12", start: "14:00", end: "16:00", reason: "บ่ายวันศุกร์งานเบา", resultingControlScore: 80 },
];
