import { ParsedTaskDraftSchema } from "@/lib/ai-parse";
import type { PlannerDraftTask } from "@/components/planner/AIPlannerDialog";

export type GuideTemplate = "school" | "work" | "project" | "blank";

export type GuideDraftItem = {
  id: string;
  title: string;
  durationMin: number;
  fixedTime?: string;
};

export type GuideTemplateDefinition = {
  id: GuideTemplate;
  title: string;
  description: string;
  items: readonly Omit<GuideDraftItem, "id">[];
};

export const GUIDE_TEMPLATES: readonly GuideTemplateDefinition[] = [
  {
    id: "school",
    title: "วันเรียน",
    description: "เริ่มจากเวลาเรียน แล้ววางการบ้าน การเดินทาง และทบทวนต่อให้พอดี",
    items: [
      { title: "เข้าเรียน", durationMin: 180, fixedTime: "09:00" },
      { title: "ทำการบ้าน", durationMin: 90 },
      { title: "เดินทางกลับ", durationMin: 60 },
      { title: "อ่านทบทวน", durationMin: 60 },
    ],
  },
  {
    id: "work",
    title: "วันทำงาน",
    description: "จัดงานสำคัญ ประชุม พัก และการเดินทางให้อยู่ในวันเดียวกัน",
    items: [
      { title: "งานสำคัญ", durationMin: 120 },
      { title: "ประชุม", durationMin: 60, fixedTime: "10:30" },
      { title: "พักกลางวัน", durationMin: 60, fixedTime: "12:00" },
      { title: "เดินทางกลับ", durationMin: 60 },
    ],
  },
  {
    id: "project",
    title: "วันทำโปรเจกต์หรืออ่านหนังสือ",
    description: "แบ่งงานหลักเป็นช่วงที่ลงมือได้ พร้อมพักและเตรียมงานถัดไป",
    items: [
      { title: "งานหลัก", durationMin: 120 },
      { title: "พัก", durationMin: 30 },
      { title: "ทบทวน", durationMin: 60 },
      { title: "เตรียมงานวันถัดไป", durationMin: 45 },
    ],
  },
  {
    id: "blank",
    title: "เริ่มจากหน้าว่าง",
    description: "เพิ่มเฉพาะสิ่งที่ต้องทำของคุณเอง โดยไม่ใช้รายการตัวอย่าง",
    items: [],
  },
] as const;

export function createGuideDrafts(template: GuideTemplate): GuideDraftItem[] {
  const definition = GUIDE_TEMPLATES.find((item) => item.id === template);
  if (!definition) return [];
  return definition.items.map((item, index) => ({
    ...item,
    id: `guide-${template}-${index + 1}`,
  }));
}

export function createBlankGuideDraft(sequence = 1): GuideDraftItem {
  return {
    id: `guide-custom-${sequence}`,
    title: "",
    durationMin: 60,
  };
}

export function toPlannerDrafts(items: readonly GuideDraftItem[]): PlannerDraftTask[] {
  return items
    .filter((item) => item.title.trim())
    .map((item) => ({
      ...ParsedTaskDraftSchema.parse({
        title: item.title.trim(),
        place: "",
        durationMin: item.durationMin,
        fixedTime: item.fixedTime || undefined,
        allDay: false,
        priority: item.fixedTime ? "high" : "normal",
        reminderOffsets: [],
        repeat: "none",
        needsReview: false,
        note: "",
      }),
      draftId: item.id,
    }));
}
