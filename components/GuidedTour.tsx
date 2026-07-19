"use client";
import { useEffect, useState } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { Modal } from "@/components/ui/modal";

const SEEN_KEY = "flow_tour_seen";

export function startTour() {
  const d = driver({
    showProgress: true,
    nextBtnText: "ต่อ",
    prevBtnText: "ย้อน",
    doneBtnText: "เริ่มเล่นเลย",
    steps: [
      { element: "[data-tour=input]", popover: { title: "①หน้าแรก = การ์ดของแต่ละวัน", description: "1 การ์ด = 1 วัน การ์ดบนสุดคือวันนี้ ถัด ๆ ไปคือวันหน้า แตะการ์ดเพื่อดูงานของวันนั้น ปุ่ม + มุมขวาล่างไว้เพิ่มงานวันใหม่" } },
      { element: "[data-tour=input]", popover: { title: "②จัด flow ด้วย AI", description: "เข้าวันแล้วเพิ่มงาน (พิมพ์ชื่อก็พอ ที่ไหน/เมื่อไหร่ค่อยเปิดทีละอัน) แล้วกด \"จัด flow\" ให้ AI จัดตาราง + เส้นทางให้ เลือกได้ เร็วสุด หรือ เครียดน้อยสุด" } },
      { element: "[data-tour=month-btn]", popover: { title: "③ทั้งเดือน", description: "กดดูภาพรวมทั้งเดือน สลับเดือนได้ จัดได้ทุกวัน ไม่ใช่แค่วันเดียว" } },
    ],
  });
  d.drive();
}

export function GuidedTour() {
  const [open, setOpen] = useState(false);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(SEEN_KEY)) {
      const t = setTimeout(() => setOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  function close(start: boolean) {
    if (dontShow) { try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } }
    setOpen(false);
    if (start) setTimeout(() => startTour(), 250);
  }

  return (
    <Modal open={open} onClose={() => close(false)} panelClassName="max-w-[360px]">
      <div className="font-grotesk text-2xl font-bold tracking-tight">flow<span className="text-[var(--flow-lime)]">_</span></div>
      <h2 className="mt-2 text-lg font-bold leading-tight">ดูวิธีใช้สั้น ๆ ก่อนมั้ย?</h2>
      <p className="mt-1 text-sm text-neutral-600">ไม่กี่ขั้นก็เข้าใจ ตั้งแต่เพิ่มงาน ให้ Flow จัดตารางทั้งวันให้ ไปจนดูเส้นทางและวางแผนทั้งเดือน</p>

      <label className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
        <input type="checkbox" checked={dontShow} onChange={(e) => setDontShow(e.target.checked)}
          className="h-4 w-4 accent-[var(--flow-ink)]" />
        ไม่ต้องแสดงอีก
      </label>

      <div className="mt-4 flex gap-2">
        <button onClick={() => close(false)} className="flow-press flex-1 rounded-xl border-[1.5px] border-[var(--flow-ink)] py-2.5 text-sm font-semibold">ข้ามไปเลย</button>
        <button onClick={() => close(true)} className="flow-press flex-[1.4] rounded-xl bg-[var(--flow-ink)] py-2.5 text-sm font-semibold text-white">ดูทัวร์</button>
      </div>
    </Modal>
  );
}
