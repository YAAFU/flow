export const THAI_SCHEDULE_EVALUATION_FIXTURES = [
  { id: "explicit-time", text: "พรุ่งนี้ตื่น 9 โมง", expectation: "09:00 on tomorrow" },
  { id: "spoken-time", text: "บ่ายสองประชุมทีม", expectation: "14:00" },
  { id: "multi-task", text: "ตื่น 9 โมง แล้วอาบน้ำครึ่งชั่วโมง", expectation: "two items" },
  { id: "relative-date", text: "มะรืนส่งรายงาน", expectation: "reference date + 2 days" },
  { id: "sequence", text: "กินข้าว จากนั้นอ่านหนังสือ 1 ชั่วโมง", expectation: "two ordered items" },
  { id: "cross-midnight", text: "ทำงาน 23:30 2 ชั่วโมง", expectation: "preserve start and duration" },
  { id: "ambiguous", text: "กลับบ้าน 16:00", expectation: "needs review" },
  { id: "not-a-task", text: "วันนี้อากาศดีมาก", expectation: "zero items" },
] as const;
