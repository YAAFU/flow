"use client";

import { useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  CalendarDays,
  Clock3,
  Coffee,
  GripVertical,
  LoaderCircle,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FlowDialog } from "@/components/ui/flow-dialog";
import { PlanningOverlay } from "@/components/PlanningOverlay";
import { ScoreCard } from "@/components/ScoreCard";
import { Timeline } from "@/components/Timeline";
import type { ParsedTaskDraft, ParsedTasksResponse } from "@/lib/ai-parse";
import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { findScheduleOverlaps } from "@/lib/schedule-validation";
import type { AiMode, PlanResult, PlanVariant, ScheduleItem, Task } from "@/lib/types";

export type PlannerDraftTask = ParsedTaskDraft & { draftId: string };
export type PlanVariantName = "A" | "B";

export type PlannerParseInput = {
  text: string;
  targetDate: string;
  dayStart: string;
  dayEnd: string;
  breakMinutes: number;
};

export type PlannerGenerateInput = Omit<PlannerParseInput, "text"> & {
  text: string;
  currentTasks: Task[];
  drafts: PlannerDraftTask[];
};

export type PlannerAppendInput = {
  targetDate: string;
  drafts: PlannerDraftTask[];
};

export type PlannerApplyInput = PlannerGenerateInput & {
  plan: PlanResult;
  variant: PlanVariantName;
};

export type AIPlannerDialogProps = {
  selectedDate: string;
  currentTasks: Task[];
  /** Supplies the single source-of-truth tasks when the user chooses another date. */
  getTasksForDate?: (date: string) => Task[];
  onTargetDateChange?: (date: string) => void;
  preferredMode?: AiMode;
  onClose: () => void;
  onParse: (input: PlannerParseInput) => Promise<ParsedTasksResponse>;
  onGeneratePlan: (input: PlannerGenerateInput) => Promise<PlanResult>;
  /** The parent must append these drafts; it must not replace existing day tasks. */
  onAppendDrafts: (input: PlannerAppendInput) => Promise<void> | void;
  /** The parent applies only the selected schedule while preserving unrelated task data. */
  onApplyPlan: (input: PlannerApplyInput) => Promise<void> | void;
  onCancelPending?: () => void;
};

type BusyAction = "parse" | "plan" | "append" | "apply" | null;

let draftSequence = 0;
function newDraftId(prefix = "draft") {
  draftSequence += 1;
  return `${prefix}-${Date.now()}-${draftSequence}`;
}
function addMinutes(time: string, durationMin: number) {
  const [hour, minute] = time.split(":").map(Number);
  const value = ((hour * 60 + minute + durationMin) % (24 * 60) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
function reorder<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function overlapRisks(schedule: ScheduleItem[]) {
  return findScheduleOverlaps(schedule).map((overlap) => ({
    time: `${overlap.start}–${overlap.end}`,
    reason: `${schedule[overlap.firstIndex].title} ทับกับ ${schedule[overlap.secondIndex].title} ${overlap.overlapMin} นาที`,
  }));
}

function refreshVariant(variant: PlanVariant, schedule: ScheduleItem[]): PlanVariant {
  const retainedRisks = variant.riskPoints.filter((risk) => !risk.reason.includes("ทับกับ"));
  const currentOverlapRisks = overlapRisks(schedule);
  const riskPoints = [...retainedRisks, ...currentOverlapRisks];
  return {
    ...variant,
    schedule,
    controlScore: controlBreakdown(schedule, riskPoints).score,
    freeTimeMin: freeTimeMin(schedule),
    riskScore: Math.max(currentOverlapRisks.length ? 25 : 0, Math.min(100, riskPoints.length * 20)),
    riskPoints,
  };
}

function modeLabel(mode: AiMode) {
  return mode === "ai" ? "AI MODE" : "LOCAL MODE";
}

function draftIsValid(draft: PlannerDraftTask) {
  return draft.title.trim().length > 0 && Number.isInteger(draft.durationMin) && draft.durationMin >= 15 && draft.durationMin <= 24 * 60;
}

export function AIPlannerDialog({
  selectedDate,
  currentTasks,
  getTasksForDate,
  onTargetDateChange,
  preferredMode = "local",
  onClose,
  onParse,
  onGeneratePlan,
  onAppendDrafts,
  onApplyPlan,
  onCancelPending,
}: AIPlannerDialogProps) {
  const errorId = useId();
  const operationRef = useRef(0);
  const [text, setText] = useState("");
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [drafts, setDrafts] = useState<PlannerDraftTask[]>([]);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [variantName, setVariantName] = useState<PlanVariantName>("A");
  const [mode, setMode] = useState<AiMode>(preferredMode);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggedDraft, setDraggedDraft] = useState<number | null>(null);
  const [draggedSchedule, setDraggedSchedule] = useState<number | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);

  const activeVariant = plan?.plans[variantName] ?? null;
  const activeOverlaps = activeVariant ? findScheduleOverlaps(activeVariant.schedule) : [];
  const targetTasks = getTasksForDate?.(targetDate) ?? currentTasks;
  const disabled = busy !== null;

  const closeWithoutSaving = () => {
    operationRef.current += 1;
    onCancelPending?.();
    onClose();
  };

  const clearFeedback = () => {
    setError("");
    setNotice("");
  };

  const validateSettings = () => {
    if (!targetDate) return "กรุณาเลือกวันที่ต้องการจัดแผน";
    if (!dayStart || !dayEnd || dayStart >= dayEnd) return "เวลาเริ่มวันต้องมาก่อนเวลาสิ้นสุดวัน";
    if (!Number.isInteger(breakMinutes) || breakMinutes < 15 || breakMinutes > 240) return "เวลาพักต้องอยู่ระหว่าง 15–240 นาที";
    return "";
  };

  const validateDrafts = () => {
    if (drafts.some((draft) => !draftIsValid(draft))) return "กรุณาตรวจชื่อและระยะเวลาของงานในฉบับร่าง";
    return "";
  };

  const parseText = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();
    const settingsError = validateSettings();
    if (settingsError) { setError(settingsError); return; }
    if (!text.trim()) { setError("กรุณาบอกงานหรือข้อจำกัดอย่างน้อยหนึ่งรายการ"); return; }

    const operation = ++operationRef.current;
    setBusy("parse");
    try {
      const response = await onParse({ text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes });
      if (operation !== operationRef.current) return;
      const nextDrafts = response.tasks.map((task) => ({ ...task, draftId: newDraftId() }));
      setDrafts(nextDrafts);
      setMode(response.mode);
      setPlan(null);
      setNotice(nextDrafts.length ? `สร้างฉบับร่าง ${nextDrafts.length} งานแล้ว ยังไม่มีการบันทึก` : "ไม่พบงานจากข้อความ กรุณาลองระบุงานและเวลาให้ชัดขึ้น");
    } catch (reason) {
      if (operation !== operationRef.current) return;
      setError(reason instanceof Error && reason.message ? reason.message : "ยังแปลงข้อความไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  };

  const updateDraft = (draftId: string, patch: Partial<PlannerDraftTask>) => {
    setDrafts((current) => current.map((draft) => draft.draftId === draftId ? { ...draft, ...patch } : draft));
    setPlan(null);
    clearFeedback();
  };

  const moveDraft = (from: number, to: number) => {
    setDrafts((current) => reorder(current, from, to));
    setPlan(null);
  };

  const addBreakDraft = () => {
    setDrafts((current) => [...current, {
      draftId: newDraftId("break"),
      title: "พัก",
      place: "",
      durationMin: breakMinutes,
      allDay: false,
      priority: "flex",
      reminderOffsets: [],
      repeat: "none",
      needsReview: false,
      note: "เพิ่มโดยผู้ใช้ในฉบับร่าง",
    }]);
    setPlan(null);
    setNotice("เพิ่มเวลาพักในฉบับร่างแล้ว");
  };

  const generatePlan = async () => {
    clearFeedback();
    const validationError = validateSettings() || validateDrafts();
    if (validationError) { setError(validationError); return; }
    if (!targetTasks.length && !drafts.length) { setError("ยังไม่มีงานสำหรับจัดแผน"); return; }

    const operation = ++operationRef.current;
    setBusy("plan");
    try {
      const response = await onGeneratePlan({
        text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes, currentTasks: targetTasks, drafts,
      });
      if (operation !== operationRef.current) return;
      setPlan(response);
      setVariantName("A");
      setMode(response.mode ?? preferredMode);
      setRiskAccepted(false);
      setNotice("สร้างแผน A และ B แล้ว ตรวจสอบก่อนบันทึก");
    } catch (reason) {
      if (operation !== operationRef.current) return;
      setError(reason instanceof Error && reason.message ? reason.message : "ยังจัดแผนไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  };

  const appendDrafts = async () => {
    clearFeedback();
    const validationError = validateSettings() || validateDrafts();
    if (validationError) { setError(validationError); return; }
    if (!drafts.length) { setError("ยังไม่มีงานฉบับร่างให้บันทึก"); return; }
    setBusy("append");
    try {
      await onAppendDrafts({ targetDate, drafts });
      setNotice(`เพิ่ม ${drafts.length} งานแล้ว โดยคงงานเดิมทั้งหมด`);
      window.setTimeout(onClose, 450);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "บันทึกงานไม่ได้ กรุณาลองอีกครั้ง");
      setBusy(null);
    }
  };

  const updateSchedule = (updater: (schedule: ScheduleItem[]) => ScheduleItem[]) => {
    if (!plan) return;
    const variant = plan.plans[variantName];
    const schedule = updater(variant.schedule);
    setPlan({ ...plan, plans: { ...plan.plans, [variantName]: refreshVariant(variant, schedule) } });
    setRiskAccepted(false);
    clearFeedback();
  };

  const addBreakToSchedule = () => {
    if (!activeVariant) return;
    const start = activeVariant.schedule.at(-1)?.end ?? dayStart;
    updateSchedule((schedule) => [...schedule, {
      taskId: newDraftId("plan-break"),
      title: "พัก",
      placeLabel: "",
      start,
      end: addMinutes(start, breakMinutes),
      travelFromPrevMin: 0,
      aiAdded: true,
    }]);
  };

  const applyPlan = async () => {
    if (!plan) return;
    clearFeedback();
    if (activeOverlaps.length && !riskAccepted) { setError("แผนยังมีเวลาทับกัน โปรดยืนยันว่าได้รับทราบก่อนบันทึก"); return; }
    setBusy("apply");
    try {
      await onApplyPlan({
        text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes, currentTasks: targetTasks, drafts, plan, variant: variantName,
      });
      setNotice(`บันทึกแผน ${variantName} แล้ว`);
      window.setTimeout(onClose, 450);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "บันทึกแผนไม่ได้ กรุณาลองอีกครั้ง");
      setBusy(null);
    }
  };

  return (
    <>
      <FlowDialog title="Flow AI Day Planner" onClose={closeWithoutSaving}>
        <div className="space-y-4">
          <section className="rounded-2xl bg-[var(--flow-ink)] p-4 text-white" aria-label="สถานะระบบวางแผน">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={17} className="text-[var(--flow-lime)]" aria-hidden />วางทั้งงาน เวลา และช่วงพัก</div>
                <p className="mt-1 text-xs leading-5 text-neutral-300">ตรวจและแก้ฉบับร่างได้ก่อนบันทึก งานเดิมที่ไม่อยู่ในแผนจะไม่ถูกลบ</p>
              </div>
              <span className="font-grotesk shrink-0 rounded-full bg-[var(--flow-lime)] px-2.5 py-1 text-[10px] font-bold text-[#111111]" aria-label={`กำลังใช้ ${modeLabel(mode)}`}>{modeLabel(mode)}</span>
            </div>
            <p className="mt-3 border-t border-white/20 pt-3 text-[11px] leading-5 text-neutral-300">
              {mode === "ai" ? "AI ช่วยตีความและจัดตาราง โปรดตรวจผลลัพธ์ก่อนใช้จริง" : "โหมด Local จัดแผนในเครื่องแบบ deterministic เมื่อไม่มี AI API"}
            </p>
          </section>

          <form onSubmit={parseText} aria-describedby={error ? errorId : undefined} className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="planner-request">บอกงานและข้อจำกัดของคุณ</label>
            <textarea
              id="planner-request"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              disabled={disabled}
              placeholder="เช่น พรุ่งนี้มีเรียน 9 โมงถึงเที่ยง ทำรายงาน 2 ชั่วโมง และซื้อของก่อน 6 โมงเย็น"
              className="min-h-28 w-full resize-y rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 py-3 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-60"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs font-semibold" htmlFor="planner-date"><CalendarDays size={14} className="mr-1 inline" aria-hidden />วันที่จัดแผน</label>
              <input id="planner-date" type="date" required value={targetDate} onChange={(event) => { const nextDate = event.target.value; setTargetDate(nextDate); onTargetDateChange?.(nextDate); setPlan(null); }} disabled={disabled} className="font-grotesk col-span-2 min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <label className="text-xs font-semibold" htmlFor="planner-start"><Clock3 size={14} className="mr-1 inline" aria-hidden />เริ่มวัน</label>
              <label className="text-xs font-semibold" htmlFor="planner-end">สิ้นสุดวัน</label>
              <input id="planner-start" type="time" required value={dayStart} onChange={(event) => { setDayStart(event.target.value); setPlan(null); }} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <input id="planner-end" type="time" required value={dayEnd} onChange={(event) => { setDayEnd(event.target.value); setPlan(null); }} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <label className="col-span-2 text-xs font-semibold" htmlFor="planner-break"><Coffee size={14} className="mr-1 inline" aria-hidden />เวลาพักเริ่มต้น (นาที)</label>
              <input id="planner-break" type="number" min={15} max={240} step={15} required value={breakMinutes} onChange={(event) => { setBreakMinutes(Number(event.target.value)); setPlan(null); }} disabled={disabled} className="font-grotesk col-span-2 min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
            </div>

            <button type="submit" disabled={disabled || !text.trim()} className="flow-press flow-inverse flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-45">
              {busy === "parse" ? <LoaderCircle size={18} className="animate-spin text-[var(--flow-lime)]" aria-hidden /> : <Bot size={18} className="text-[var(--flow-lime)]" aria-hidden />}
              {busy === "parse" ? "กำลังสร้างฉบับร่าง" : "แปลงข้อความเป็นฉบับร่าง"}
            </button>
          </form>

          {(error || notice) && (
            <div id={errorId} role={error ? "alert" : "status"} aria-live="polite" className={`rounded-xl border-[1.5px] px-3 py-2.5 text-sm ${error ? "border-red-700 bg-red-50 text-red-800" : "border-[var(--flow-line)] bg-[var(--flow-lime)] text-[#111111]"}`}>
              {error || notice}
            </div>
          )}

          <section className="border-t flow-hairline pt-4" aria-labelledby="planner-draft-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 id="planner-draft-heading" className="font-semibold">ฉบับร่างก่อนบันทึก</h3>
                <p className="mt-0.5 text-xs text-[var(--flow-muted)]">งานเดิม {targetTasks.length} รายการ · งานใหม่ {drafts.length} รายการ</p>
              </div>
              <button type="button" onClick={addBreakDraft} disabled={disabled} className="flow-press flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 text-xs font-semibold disabled:opacity-45"><Plus size={15} aria-hidden />เพิ่มเวลาพัก</button>
            </div>

            {drafts.length === 0 ? (
              <div className="mt-3 rounded-2xl border-[1.5px] border-dashed border-[var(--flow-line)] p-4 text-center text-sm text-[var(--flow-muted)]">
                ใช้ข้อความด้านบนเพื่อสร้างงานใหม่ หรือจัดแผนจากงานที่มีอยู่แล้ว
              </div>
            ) : (
              <ol className="mt-3 space-y-2" aria-label="รายการงานฉบับร่าง">
                {drafts.map((draft, index) => (
                  <li
                    key={draft.draftId}
                    draggable={!disabled}
                    onDragStart={() => setDraggedDraft(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => { if (draggedDraft !== null) moveDraft(draggedDraft, index); setDraggedDraft(null); }}
                    onDragEnd={() => setDraggedDraft(null)}
                    className="rounded-2xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] p-3"
                  >
                    <div className="mb-2 flex items-center gap-1">
                      <GripVertical size={17} className="text-[var(--flow-muted)]" aria-hidden />
                      <span className="font-grotesk mr-auto text-[10px] font-bold text-[var(--flow-muted)]">DRAFT {index + 1}</span>
                      <button type="button" onClick={() => moveDraft(index, index - 1)} disabled={disabled || index === 0} className="flow-press grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`เลื่อน ${draft.title} ขึ้น`}><ArrowUp size={16} aria-hidden /></button>
                      <button type="button" onClick={() => moveDraft(index, index + 1)} disabled={disabled || index === drafts.length - 1} className="flow-press grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`เลื่อน ${draft.title} ลง`}><ArrowDown size={16} aria-hidden /></button>
                      <button type="button" onClick={() => { setDrafts((current) => current.filter((item) => item.draftId !== draft.draftId)); setPlan(null); }} disabled={disabled} className="flow-press grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`ลบ ${draft.title} จากฉบับร่าง`}><Trash2 size={16} aria-hidden /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="col-span-2 text-xs font-semibold" htmlFor={`${draft.draftId}-title`}>ชื่องาน</label>
                      <input id={`${draft.draftId}-title`} value={draft.title} onChange={(event) => updateDraft(draft.draftId, { title: event.target.value })} disabled={disabled} className="col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <label className="text-xs font-semibold" htmlFor={`${draft.draftId}-time`}>เวลาเริ่ม</label>
                      <label className="text-xs font-semibold" htmlFor={`${draft.draftId}-duration`}>ระยะเวลา</label>
                      <input id={`${draft.draftId}-time`} type="time" value={draft.fixedTime ?? ""} onChange={(event) => updateDraft(draft.draftId, { fixedTime: event.target.value || undefined, allDay: false })} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <div className="relative"><input id={`${draft.draftId}-duration`} type="number" min={15} max={1440} step={15} value={draft.durationMin} onChange={(event) => updateDraft(draft.draftId, { durationMin: Number(event.target.value) })} disabled={disabled} className="font-grotesk min-h-11 w-full rounded-xl border border-[var(--flow-line)] px-3 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" /><span className="pointer-events-none absolute right-3 top-3 text-xs text-[var(--flow-muted)]">นาที</span></div>
                      <label className="col-span-2 text-xs font-semibold" htmlFor={`${draft.draftId}-place`}><MapPin size={13} className="mr-1 inline" aria-hidden />สถานที่</label>
                      <input id={`${draft.draftId}-place`} value={draft.place} onChange={(event) => updateDraft(draft.draftId, { place: event.target.value })} disabled={disabled} placeholder="ไม่ระบุ" className="col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                    </div>
                    {draft.needsReview && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />ข้อมูลเวลายังไม่ครบ กรุณาตรวจสอบก่อนยืนยัน</p>}
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={appendDrafts} disabled={disabled || drafts.length === 0} className="flow-press min-h-12 rounded-2xl border-[1.5px] border-[var(--flow-line)] px-3 text-sm font-semibold disabled:opacity-40">{busy === "append" ? "กำลังบันทึก" : "บันทึกเฉพาะงานใหม่"}</button>
              <button type="button" onClick={generatePlan} disabled={disabled || (!targetTasks.length && !drafts.length)} className="flow-press min-h-12 rounded-2xl bg-[var(--flow-lime)] px-3 text-sm font-semibold text-[#111111] disabled:opacity-40">{busy === "plan" ? "กำลังจัดแผน" : "จัดแผนจากงานทั้งหมด"}</button>
            </div>
          </section>

          {plan && activeVariant && (
            <section className="border-t flow-hairline pt-4" aria-labelledby="planner-result-heading">
              <div className="flex items-start justify-between gap-3">
                <div><h3 id="planner-result-heading" className="font-semibold">ตรวจแผนก่อนบันทึก</h3><p className="mt-0.5 text-xs text-[var(--flow-muted)]">แก้เวลา ลำดับ ชื่อ หรือลบรายการออกจากแผนได้</p></div>
                <span className="font-grotesk rounded-full border border-[var(--flow-line)] px-2 py-1 text-[10px] font-bold">{modeLabel(plan.mode ?? mode)}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 rounded-xl border-[1.5px] border-[var(--flow-line)] p-1" role="tablist" aria-label="เลือกฉบับแผน">
                {(["A", "B"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={variantName === name} onClick={() => { setVariantName(name); setRiskAccepted(false); }} className={`flow-press min-h-11 rounded-lg text-sm font-semibold ${variantName === name ? "bg-[var(--flow-ink)] text-white" : "text-[var(--flow-muted)]"}`}>แผน {name}</button>)}
              </div>

              <p className="mt-3 rounded-xl bg-[var(--flow-surface)] p-3 text-xs leading-5 text-[var(--flow-muted)]">{plan.summary}</p>

              <ol className="mt-3 space-y-2" aria-label={`แก้รายการแผน ${variantName}`}>
                {activeVariant.schedule.map((item, index) => (
                  <li key={`${item.taskId}-${index}`} draggable={!disabled} onDragStart={() => setDraggedSchedule(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedSchedule !== null) updateSchedule((items) => reorder(items, draggedSchedule, index)); setDraggedSchedule(null); }} onDragEnd={() => setDraggedSchedule(null)} className="rounded-xl border border-[var(--flow-line)] p-2.5">
                    <div className="flex items-center gap-1">
                      <GripVertical size={16} className="text-[var(--flow-muted)]" aria-hidden />
                      <span className="font-grotesk mr-auto text-[10px] font-bold text-[var(--flow-muted)]">{item.start}–{item.end}</span>
                      <button type="button" onClick={() => updateSchedule((items) => reorder(items, index, index - 1))} disabled={index === 0} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`เลื่อน ${item.title} ขึ้น`}><ArrowUp size={15} aria-hidden /></button>
                      <button type="button" onClick={() => updateSchedule((items) => reorder(items, index, index + 1))} disabled={index === activeVariant.schedule.length - 1} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`เลื่อน ${item.title} ลง`}><ArrowDown size={15} aria-hidden /></button>
                      <button type="button" onClick={() => updateSchedule((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)]" aria-label={`ลบ ${item.title} จากแผน`}><Trash2 size={15} aria-hidden /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="sr-only" htmlFor={`plan-${variantName}-${index}-title`}>ชื่องาน</label>
                      <input id={`plan-${variantName}-${index}-title`} value={item.title} onChange={(event) => updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} className="col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <label className="sr-only" htmlFor={`plan-${variantName}-${index}-start`}>เวลาเริ่ม</label>
                      <input id={`plan-${variantName}-${index}-start`} type="time" value={item.start} onChange={(event) => updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, start: event.target.value } : current))} className="font-grotesk min-h-11 min-w-0 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <label className="sr-only" htmlFor={`plan-${variantName}-${index}-end`}>เวลาสิ้นสุด</label>
                      <input id={`plan-${variantName}-${index}-end`} type="time" value={item.end} onChange={(event) => updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, end: event.target.value } : current))} className="font-grotesk min-h-11 min-w-0 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                    </div>
                  </li>
                ))}
              </ol>

              <button type="button" onClick={addBreakToSchedule} className="flow-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[var(--flow-line)] text-sm font-semibold"><Coffee size={16} aria-hidden />เพิ่มช่วงพัก {breakMinutes} นาทีในแผน</button>

              <div className="mt-4"><ScoreCard controlScore={activeVariant.controlScore} freeTimeMin={activeVariant.freeTimeMin} tip={plan.tip} schedule={activeVariant.schedule} riskPoints={activeVariant.riskPoints} planLabel={`แผน ${variantName}`} altPlan={{ label: `แผน ${variantName === "A" ? "B" : "A"}`, score: plan.plans[variantName === "A" ? "B" : "A"].controlScore, onSwitch: () => { setVariantName(variantName === "A" ? "B" : "A"); setRiskAccepted(false); } }} /></div>
              <div className="mt-4"><Timeline items={activeVariant.schedule} riskPoints={activeVariant.riskPoints} /></div>

              {activeOverlaps.length > 0 && (
                <label className="mt-3 flex min-h-12 cursor-pointer items-start gap-2 rounded-xl border-[1.5px] border-red-700 bg-red-50 p-3 text-sm text-red-900">
                  <input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#111111]" />
                  <span><strong>พบเวลาทับกัน {activeOverlaps.length} จุด</strong><br /><span className="text-xs">ฉันตรวจสอบแล้วและต้องการบันทึกแผนนี้</span></span>
                </label>
              )}

              <button type="button" onClick={applyPlan} disabled={disabled || !activeVariant.schedule.length || (activeOverlaps.length > 0 && !riskAccepted)} className="flow-press flow-inverse mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-40">{busy === "apply" ? <LoaderCircle size={18} className="animate-spin text-[var(--flow-lime)]" aria-hidden /> : <Sparkles size={18} className="text-[var(--flow-lime)]" aria-hidden />}{busy === "apply" ? "กำลังบันทึกแผน" : `ยืนยันแผน ${variantName}`}</button>
            </section>
          )}

          <button type="button" onClick={closeWithoutSaving} disabled={busy === "append" || busy === "apply"} className="flow-press min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--flow-muted)] disabled:opacity-40">ยกเลิกโดยไม่บันทึก</button>
        </div>
      </FlowDialog>
      <PlanningOverlay open={busy === "plan"} taskCount={targetTasks.length + drafts.length} onCancel={() => { operationRef.current += 1; onCancelPending?.(); setBusy(null); setError("ยกเลิกการจัดแผนแล้ว ยังไม่มีการบันทึก"); }} />
    </>
  );
}
