"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Task } from "@/lib/types";
import { resolvePlace } from "@/lib/places";

const PLACEHOLDER = `พิมพ์เล่าวันของคุณเป็นข้อความได้เลย เช่น:
เที่ยงทำงานออฟฟิศที่สยาม 2 ชม
สองทุ่มกลับบ้านคุยกับน้อง 1 ชม
เที่ยงคืนกลับไปทำงานต่อที่สยาม 3 ชม`;

type Parsed = { title: string; place: string; durationMin: number; fixedTime: string; priority: Task["priority"]; needsReview: boolean; note: string };

export function TextTaskInput({ onParsed }: { onParsed: (tasks: Task[]) => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function parse() {
    if (text.trim().length < 3) return;
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (!r.ok) { setErr("แปลงไม่สำเร็จ ลองเล่าให้ชัดขึ้นแล้วลองใหม่"); return; }
      const d = await r.json();
      const tasks: Task[] = (d.tasks ?? []).map((t: Parsed) => {
        const p = t.place ? resolvePlace(t.place) : undefined;
        return {
          id: crypto.randomUUID(), title: t.title || "งาน",
          place: t.place || "ยังไม่ระบุ", lat: p?.lat, lng: p?.lng,
          durationMin: t.durationMin || 60, fixedTime: t.fixedTime || undefined,
          priority: t.priority || "normal",
          needsReview: !!t.needsReview, note: t.note || undefined,
        };
      });
      if (!tasks.length) { setErr("ไม่เจองานในข้อความ ลองเล่าใหม่"); return; }
      onParsed(tasks);
    } catch { setErr("แปลงไม่สำเร็จ"); } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={PLACEHOLDER}
        className="w-full resize-none rounded-2xl border-[1.5px] border-[var(--flow-ink)] p-3 text-sm outline-none placeholder:whitespace-pre-line placeholder:text-neutral-300" />
      {err && <div className="text-xs text-red-500">{err}</div>}
      <button onClick={parse} disabled={loading || text.trim().length < 3}
        className="flow-press flex items-center justify-center gap-1.5 rounded-xl bg-[var(--flow-ink)] py-2.5 text-sm font-semibold text-white disabled:opacity-30">
        <Sparkles size={16} className="text-[var(--flow-lime)]" /> {loading ? "AI กำลังแปลง..." : "ให้ AI แปลงเป็นงาน"}
      </button>
    </div>
  );
}
