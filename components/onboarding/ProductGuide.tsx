"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { GuideProgress } from "@/components/onboarding/GuideProgress";
import { EnergyLevelSelector } from "@/components/planner/EnergyLevelSelector";
import { ScoreCard } from "@/components/ScoreCard";
import { useFlowStore } from "@/hooks/useFlowStore";
import {
  GUIDE_TEMPLATES,
  createBlankGuideDraft,
  createGuideDrafts,
  toPlannerDrafts,
  type GuideDraftItem,
  type GuideTemplate,
} from "@/lib/guide-templates";
import {
  applyGuidePlan,
  buildGuidePlanningContext,
  buildLocalGuidePlan,
  guideDraftsToTasks,
  type GuidePlanSettings,
} from "@/lib/guide-planner";
import {
  completeOnboarding,
  loadOnboardingState,
  resetOnboardingState,
  skipOnboarding,
  startOnboarding,
  updateOnboardingState,
} from "@/lib/onboarding";
import { trackProductEvent } from "@/lib/product-analytics";
import { PlanResultSchema, type DayEnergy, type PlanResult } from "@/lib/types";
import { localDateKey } from "@/lib/time";

type GuideStep = 1 | 2 | 3 | 4;
type PlanVariantName = "A" | "B";

function durationBucket(startedAt: number) {
  const seconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  if (seconds < 30) return "under_30s" as const;
  if (seconds < 60) return "30_60s" as const;
  if (seconds < 90) return "60_90s" as const;
  return "over_90s" as const;
}

function rekeyDrafts(items: GuideDraftItem[]): GuideDraftItem[] {
  const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return items.map((item, index) => ({ ...item, id: `guide-${seed}-${index + 1}` }));
}

function friendlyMinutes(value: number) {
  if (value < 60) return `${value} นาที`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours} ชม.${minutes ? ` ${minutes} นาที` : ""}`;
}

function StepOne() {
  const before = ["เรียน", "ทำรายงาน", "เดินทาง", "อ่านหนังสือ"];
  const after = [
    ["09:00–12:00", "เรียน"],
    ["13:00–14:30", "ทำรายงาน"],
    ["16:00–17:00", "เดินทาง"],
    ["19:00–20:00", "อ่านหนังสือ"],
  ];
  return (
    <section aria-labelledby="guide-step-one">
      <p className="text-xs font-semibold text-[var(--flow-lime-dark)]">เริ่มจากสิ่งที่คุณรู้อยู่แล้ว</p>
      <h1 id="guide-step-one" className="mt-2 text-[clamp(1.8rem,7vw,2.7rem)] font-bold leading-[1.12] tracking-[-0.035em]">
        มีหลายอย่างต้องทำ แต่ไม่รู้จะเริ่มอะไรก่อน?
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--flow-muted)]">
        บอกสิ่งที่ต้องทำและเวลาที่มี แล้ว Flow จะช่วยเปลี่ยนรายการเหล่านั้นให้เป็นแผนของวัน
      </p>

      <div className="mt-7 grid gap-3 md:grid-cols-[.8fr_1.2fr]">
        <article className="flow-surface rounded-[22px] border-[1.5px] border-[var(--flow-line)] p-4">
          <p className="text-xs font-semibold text-[var(--flow-muted)]">ก่อนจัด · มีเพียงรายการ</p>
          <ul className="mt-3 grid gap-2">
            {before.map((item) => <li key={item} className="rounded-xl bg-[var(--flow-paper)] px-3 py-2.5 text-sm font-semibold">{item}</li>)}
          </ul>
        </article>
        <article className="flow-inverse rounded-[22px] border-[1.5px] border-[#111111] p-4 shadow-[var(--flow-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-white/65">หลังจัด · เห็นเวลาที่ลงมือได้</p>
            <span className="rounded-full bg-[var(--flow-lime)] px-2.5 py-1 text-[10px] font-bold text-[#111111]">FLOW PLAN</span>
          </div>
          <ol className="mt-3 grid gap-2">
            {after.map(([time, title]) => (
              <li key={title} className="grid grid-cols-[6.2rem_1fr] gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-sm">
                <span className="font-grotesk text-[var(--flow-lime)]">{time}</span><span className="font-semibold">{title}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-2 text-sm text-white/75"><Coffee size={16} className="text-[var(--flow-lime)]" aria-hidden />เหลือเวลาพัก 2 ชั่วโมง</p>
        </article>
      </div>
    </section>
  );
}

function StepTwo() {
  return (
    <section aria-labelledby="guide-step-two">
      <p className="text-xs font-semibold text-[var(--flow-lime-dark)]">คนละหน้าที่ ช่วยกันได้</p>
      <h1 id="guide-step-two" className="mt-2 text-[clamp(1.75rem,7vw,2.5rem)] font-bold leading-tight tracking-[-0.03em]">
        Flow ต่างจากปฏิทินอย่างไร
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--flow-muted)]">
        ปฏิทินเหมาะกับเวลาที่คุณเลือกไว้แล้ว ส่วน Flow ช่วยเปลี่ยนสิ่งที่ต้องทำให้เป็นแผนที่ตรวจสอบได้ก่อนใช้จริง
      </p>
      <div className="mt-7 grid gap-3 md:grid-cols-2">
        <article className="flow-surface rounded-[22px] border-[1.5px] border-[var(--flow-line)] p-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--flow-line)]"><CalendarClock size={20} aria-hidden /></div>
          <h2 className="mt-4 text-lg font-bold">ปฏิทินทั่วไป</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-[var(--flow-muted)]">
            {["ผู้ใช้เลือกเวลาเอง", "บันทึกนัดหมาย", "แสดงว่าวันนั้นมีอะไร"].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-1 shrink-0" aria-hidden />{item}</li>)}
          </ul>
        </article>
        <article className="flow-inverse rounded-[22px] border-[1.5px] border-[#111111] p-5 shadow-[var(--flow-shadow)]">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--flow-lime)] text-[#111111]"><Sparkles size={20} aria-hidden /></div>
          <h2 className="mt-4 text-lg font-bold">Flow</h2>
          <ul className="mt-3 space-y-3 text-sm leading-6 text-white/75">
            {["เริ่มจากรายการสิ่งที่ต้องทำ", "ช่วยจัดเวลาและลำดับ", "ตรวจช่วงเวลาชนก่อนบันทึก", "แสดงงานตอนนี้ งานถัดไป และเวลาว่าง", "ต่อไปยัง Timeline และ Focus ได้"].map((item) => <li key={item} className="flex gap-2"><Check size={16} className="mt-1 shrink-0 text-[var(--flow-lime)]" aria-hidden />{item}</li>)}
          </ul>
        </article>
      </div>
    </section>
  );
}

function StepThree({
  template,
  drafts,
  onTemplate,
  onChange,
  onDelete,
  onAdd,
}: {
  template: GuideTemplate | null;
  drafts: GuideDraftItem[];
  onTemplate: (template: GuideTemplate) => void;
  onChange: (id: string, patch: Partial<GuideDraftItem>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <section aria-labelledby="guide-step-three">
      <p className="text-xs font-semibold text-[var(--flow-lime-dark)]">ตัวช่วยเริ่มต้น ไม่ใช่การระบุตัวตน</p>
      <h1 id="guide-step-three" className="mt-2 text-[clamp(1.7rem,7vw,2.4rem)] font-bold leading-tight tracking-[-0.03em]">
        เลือกวันที่ใกล้กับชีวิตคุณ
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--flow-muted)]">เลือกเพียงเพื่อได้รายการตั้งต้น คุณแก้หรือลบทุกอย่างได้ และยังไม่มีอะไรถูกบันทึกเป็นงานจริง</p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="เลือกวันตัวอย่าง">
        {GUIDE_TEMPLATES.map((option) => {
          const selected = template === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onTemplate(option.id)}
              className={`flow-press min-h-[92px] rounded-2xl border-[1.5px] p-3 text-left ${selected ? "border-[var(--flow-ink)] bg-[var(--flow-lime)] text-[#111111]" : "border-[var(--flow-line)] bg-[var(--flow-paper)]"}`}
            >
              <span className="flex items-center justify-between gap-2 font-bold">{option.title}{selected && <CheckCircle2 size={18} aria-hidden />}</span>
              <span className={`mt-1 block text-xs leading-5 ${selected ? "text-[#303020]" : "text-[var(--flow-muted)]"}`}>{option.description}</span>
            </button>
          );
        })}
      </div>

      {template && (
        <div className="mt-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">ฉบับร่างตัวอย่าง</h2>
              <p className="mt-0.5 text-xs text-[var(--flow-muted)]">แก้ได้ก่อนจัดวัน · ยังไม่บันทึกลงงานจริง</p>
            </div>
            <span className="rounded-full border border-[var(--flow-line)] px-2.5 py-1 text-[10px] font-bold">ตัวอย่าง</span>
          </div>
          <ol className="mt-3 space-y-2">
            {drafts.map((draft, index) => (
              <li key={draft.id} className="rounded-2xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] p-3">
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <label className="text-xs font-semibold" htmlFor={`${draft.id}-title`}>รายการที่ {index + 1}
                    <input id={`${draft.id}-title`} value={draft.title} onChange={(event) => onChange(draft.id, { title: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-3 text-sm" />
                  </label>
                  <button type="button" onClick={() => onDelete(draft.id)} aria-label={`ลบ ${draft.title || `รายการที่ ${index + 1}`}`} className="mt-5 grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] text-[var(--flow-muted)]"><Trash2 size={16} aria-hidden /></button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold" htmlFor={`${draft.id}-duration`}>ใช้เวลาประมาณ
                    <span className="relative mt-1 block"><input id={`${draft.id}-duration`} type="number" min="15" max="480" step="15" value={draft.durationMin} onChange={(event) => onChange(draft.id, { durationMin: Math.max(15, Math.min(480, Number(event.target.value) || 15)) })} className="font-grotesk min-h-11 w-full rounded-xl border border-[var(--flow-line)] bg-transparent px-3 pr-12" /><span className="pointer-events-none absolute right-3 top-3 font-normal text-[var(--flow-muted)]">นาที</span></span>
                  </label>
                  <label className="text-xs font-semibold" htmlFor={`${draft.id}-time`}>เวลาเริ่ม (ถ้ามี)
                    <input id={`${draft.id}-time`} type="time" value={draft.fixedTime ?? ""} onChange={(event) => onChange(draft.id, { fixedTime: event.target.value || undefined })} className="font-grotesk mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--flow-line)] bg-transparent px-3" />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={onAdd} className="flow-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[var(--flow-line)] text-sm font-semibold"><Plus size={16} aria-hidden />เพิ่มรายการ</button>
        </div>
      )}
    </section>
  );
}

export function ProductGuide() {
  const router = useRouter();
  const { state: flowState, hydrated, updateFlow } = useFlowStore();
  const initialized = useRef(false);
  const startedAt = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [step, setStep] = useState<GuideStep>(1);
  const [template, setTemplate] = useState<GuideTemplate | null>(null);
  const [drafts, setDrafts] = useState<GuideDraftItem[]>([]);
  const [date, setDate] = useState(() => localDateKey());
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("20:00");
  const [energy, setEnergy] = useState<DayEnergy>("medium");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [variant, setVariant] = useState<PlanVariantName>("A");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated || initialized.current) return;
    const timer = window.setTimeout(() => {
      if (initialized.current) return;
      initialized.current = true;
      startedAt.current = Date.now();
      const params = new URLSearchParams(window.location.search);
      const requestedStart = params.get("start");
      const shouldRestart = params.get("restart") === "1";

      if (shouldRestart) resetOnboardingState(window.localStorage);
      const saved = loadOnboardingState(window.localStorage);

      if (requestedStart === "templates") {
        startOnboarding(window.localStorage, 3);
        setStep(3);
        setTemplate(null);
        setDrafts([]);
        trackProductEvent("guide_started", { entryPoint: "empty_state" });
      } else if (requestedStart === "comparison") {
        startOnboarding(window.localStorage, 2);
        setStep(2);
        trackProductEvent("guide_started", { entryPoint: "settings" });
      } else if (saved.status === "started") {
        setStep(saved.currentStep as GuideStep);
        setTemplate(saved.selectedTemplate);
        if (saved.draft) {
          setDate(saved.draft.date);
          setDayStart(saved.draft.dayStart);
          setDayEnd(saved.draft.dayEnd);
          setEnergy(saved.draft.energy);
          setDrafts(saved.draft.items.map((item) => ({
            id: item.id,
            title: item.title,
            durationMin: item.durationMin ?? 60,
            fixedTime: item.fixedTime,
          })));
        }
        setResumed(saved.currentStep > 1 || Boolean(saved.draft));
        if (saved.startedAt) startedAt.current = Date.parse(saved.startedAt);
      }

      if (requestedStart || shouldRestart) {
        window.history.replaceState(window.history.state, "", "/guide");
      }
      trackProductEvent("guide_viewed", { entryPoint: "guide" });
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated]);

  useEffect(() => {
    if (!ready) return;
    if (step < 3) {
      updateOnboardingState(window.localStorage, { currentStep: step });
      return;
    }
    updateOnboardingState(window.localStorage, {
      currentStep: step,
      selectedTemplate: template,
      draft: {
        date,
        dayStart,
        dayEnd,
        energy,
        items: drafts.filter((item) => item.title.trim()).map((item) => ({
          id: item.id,
          title: item.title.trim(),
          durationMin: item.durationMin,
          fixedTime: item.fixedTime,
          priority: item.fixedTime ? "high" : "normal",
        })),
      },
    });
  }, [date, dayEnd, dayStart, drafts, energy, ready, step, template]);

  const usefulDrafts = useMemo(() => drafts.filter((item) => item.title.trim()), [drafts]);
  const activePlan = plan?.plans[variant] ?? null;

  const setCurrentStep = (next: GuideStep) => {
    if (next > step) trackProductEvent("guide_step_completed", { step });
    setError("");
    setPlan(null);
    setStep(next);
    updateOnboardingState(window.localStorage, { status: "started", currentStep: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const beginGuide = () => {
    startOnboarding(window.localStorage, 2);
    trackProductEvent("guide_started", { entryPoint: "guide" });
    setCurrentStep(2);
  };

  const skipGuide = () => {
    skipOnboarding(window.localStorage);
    trackProductEvent("guide_skipped", { step, entryPoint: "guide" });
    router.replace("/app");
  };

  const restartGuide = () => {
    resetOnboardingState(window.localStorage);
    startOnboarding(window.localStorage, 1);
    startedAt.current = Date.now();
    setStep(1);
    setTemplate(null);
    setDrafts([]);
    setDate(localDateKey());
    setDayStart("08:00");
    setDayEnd("20:00");
    setEnergy("medium");
    setPlan(null);
    setError("");
    setResumed(false);
  };

  const chooseTemplate = (nextTemplate: GuideTemplate) => {
    const nextDrafts = rekeyDrafts(createGuideDrafts(nextTemplate));
    setTemplate(nextTemplate);
    setDrafts(nextDrafts.length ? nextDrafts : [rekeyDrafts([createBlankGuideDraft()])[0]]);
    setPlan(null);
    trackProductEvent("persona_example_selected", { templateType: nextTemplate });
  };

  const updateDraft = (id: string, patch: Partial<GuideDraftItem>) => {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setPlan(null);
  };

  const addDraft = () => {
    const next = createBlankGuideDraft(drafts.length + 1);
    setDrafts((current) => [...current, rekeyDrafts([next])[0]]);
    setPlan(null);
  };

  const generatePlan = async () => {
    setError("");
    if (!usefulDrafts.length) { setError("เพิ่มอย่างน้อยหนึ่งรายการก่อนจัดวัน"); return; }
    if (!date || !dayStart || !dayEnd || dayStart >= dayEnd) { setError("ตรวจวันที่และช่วงเวลาให้เวลาเริ่มอยู่ก่อนเวลาสิ้นสุด"); return; }
    const plannerDrafts = toPlannerDrafts(usefulDrafts);
    const settings: GuidePlanSettings = { date, dayStart, dayEnd, energy, breakMin: 30 };
    const tasks = guideDraftsToTasks(plannerDrafts, flowState);
    const requestStartedAt = Date.now();
    setBusy(true);
    try {
      let nextPlan: PlanResult;
      if (navigator.onLine) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 25_000);
        try {
          const response = await fetch("/api/plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              planningContext: buildGuidePlanningContext(tasks, settings),
              dayStart,
              dayEnd,
              breakMin: 30,
            }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error(`plan_${response.status}`);
          nextPlan = PlanResultSchema.parse(await response.json());
        } finally {
          window.clearTimeout(timeout);
        }
      } else {
        nextPlan = buildLocalGuidePlan(tasks, settings);
      }
      setPlan(nextPlan);
      setVariant(nextPlan.plans.B.controlScore > nextPlan.plans.A.controlScore ? "B" : "A");
      trackProductEvent("first_plan_generated", {
        plannerMode: nextPlan.mode ?? "local",
        completionStatus: "success",
        durationBucket: durationBucket(requestStartedAt),
      });
    } catch {
      const fallback = buildLocalGuidePlan(tasks, settings);
      setPlan(fallback);
      setVariant(fallback.plans.B.controlScore > fallback.plans.A.controlScore ? "B" : "A");
      trackProductEvent("first_plan_generated", {
        plannerMode: "local",
        completionStatus: "success",
        durationBucket: durationBucket(requestStartedAt),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmPlan = () => {
    if (!plan) return;
    const plannerDrafts = toPlannerDrafts(usefulDrafts);
    const settings: GuidePlanSettings = { date, dayStart, dayEnd, energy, breakMin: 30 };
    const hadNoTasks = Object.values(flowState.tasksByDay).flat().length === 0;
    updateFlow((previous) => applyGuidePlan(previous, { settings, drafts: plannerDrafts, plan, variant }));
    completeOnboarding(window.localStorage);
    if (hadNoTasks) trackProductEvent("first_task_created", { entryPoint: "guide" });
    trackProductEvent("guide_step_completed", { step: 4 });
    trackProductEvent("guide_completed", {
      completionStatus: "success",
      durationBucket: durationBucket(startedAt.current ?? Date.now()),
    });
    router.replace(`/app?date=${encodeURIComponent(date)}&view=timeline&onboarding=success`);
  };

  if (!ready) {
    return <main className="grid min-h-dvh place-items-center bg-[var(--flow-paper)] text-[var(--flow-ink)]"><p className="text-sm text-[var(--flow-muted)]">กำลังเตรียม Guide…</p></main>;
  }

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[var(--flow-paper)] pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] text-[var(--flow-ink)]">
      <div className="mx-auto w-full max-w-[760px] px-4 pt-4 sm:px-6 sm:pt-7">
        <header className="flex items-start justify-between gap-4">
          <a href="/login" className="font-grotesk inline-flex min-h-11 items-center text-[24px] font-bold tracking-[-0.04em]">flow<span className="text-[var(--flow-lime-dark)]">_</span></a>
          <button type="button" onClick={skipGuide} className="flow-press min-h-11 rounded-xl px-3 text-sm font-semibold text-[var(--flow-muted)]">ข้ามและเริ่มใช้</button>
        </header>
        <div className="mt-4 rounded-2xl border border-[var(--flow-line)] p-3 sm:p-4"><GuideProgress current={step} /></div>
        {resumed && (
          <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[var(--flow-lime)] px-3 py-2.5 text-sm text-[#111111]">
            <span>กลับมาต่อจากฉบับร่างเดิมแล้ว</span>
            <button type="button" onClick={restartGuide} className="min-h-11 shrink-0 rounded-lg px-2 font-semibold underline">เริ่มใหม่</button>
          </div>
        )}

        <div key={step} className="flow-view mt-7">
          {step === 1 && <StepOne />}
          {step === 2 && <StepTwo />}
          {step === 3 && <StepThree template={template} drafts={drafts} onTemplate={chooseTemplate} onChange={updateDraft} onDelete={(id) => setDrafts((current) => current.filter((item) => item.id !== id))} onAdd={addDraft} />}
          {step === 4 && (
            <section aria-labelledby="guide-step-four">
              <p className="text-xs font-semibold text-[var(--flow-lime-dark)]">ตรวจแล้วค่อยบันทึก</p>
              <h1 id="guide-step-four" className="mt-2 text-[clamp(1.7rem,7vw,2.4rem)] font-bold leading-tight tracking-[-0.03em]">สร้างแผนวันแรก</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--flow-muted)]">Flow จะลองจัดเวลาให้ก่อน คุณยังกลับไปแก้รายการได้ และข้อมูลจะเป็นงานจริงเมื่อกดยืนยันแผนเท่านั้น</p>

              <div className="flow-form mt-6 grid gap-3 rounded-[22px] border-[1.5px] border-[var(--flow-line)] p-4 sm:grid-cols-2">
                <label className="text-sm font-semibold sm:col-span-2" htmlFor="guide-date">วันที่ต้องการจัดแผน
                  <input id="guide-date" type="date" required value={date} onChange={(event) => { setDate(event.target.value); setPlan(null); }} className="font-grotesk mt-1 min-h-12 w-full rounded-xl border px-3" />
                </label>
                <label className="text-sm font-semibold" htmlFor="guide-start">เริ่มวัน
                  <input id="guide-start" type="time" required value={dayStart} onChange={(event) => { setDayStart(event.target.value); setPlan(null); }} className="font-grotesk mt-1 min-h-12 w-full rounded-xl border px-3" />
                </label>
                <label className="text-sm font-semibold" htmlFor="guide-end">สิ้นสุดวัน
                  <input id="guide-end" type="time" required value={dayEnd} onChange={(event) => { setDayEnd(event.target.value); setPlan(null); }} className="font-grotesk mt-1 min-h-12 w-full rounded-xl border px-3" />
                </label>
                <div className="sm:col-span-2"><EnergyLevelSelector value={energy} onChange={(value) => { setEnergy(value); setPlan(null); }} disabled={busy} /></div>
              </div>

              <div className="mt-4 rounded-[22px] bg-[var(--flow-surface)] p-4">
                <div className="flex items-center justify-between gap-3"><h2 className="font-bold">รายการที่จะนำไปจัด</h2><button type="button" onClick={() => setCurrentStep(3)} className="min-h-11 rounded-lg px-2 text-sm font-semibold underline">แก้รายการ</button></div>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">{usefulDrafts.map((item) => <li key={item.id} className="rounded-xl bg-[var(--flow-paper)] px-3 py-2 text-sm"><strong>{item.title}</strong><span className="font-grotesk ml-2 text-xs text-[var(--flow-muted)]">{item.fixedTime ? `${item.fixedTime} · ` : ""}{item.durationMin} นาที</span></li>)}</ul>
              </div>

              {error && <p role="alert" className="mt-3 rounded-xl border-[1.5px] border-red-700 bg-red-50 px-3 py-2.5 text-sm text-red-800">{error}</p>}

              {!plan ? (
                <button type="button" onClick={generatePlan} disabled={busy || !usefulDrafts.length} className="flow-press flow-inverse mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-45">
                  <Sparkles size={18} className="text-[var(--flow-lime)]" aria-hidden />{busy ? "กำลังจัดวัน…" : "จัดวันแรกของฉัน"}
                </button>
              ) : activePlan ? (
                <div className="mt-5 rounded-[22px] border-[1.5px] border-[var(--flow-line)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h2 className="font-bold">แผนพร้อมให้ตรวจแล้ว</h2><p className="mt-1 text-xs text-[var(--flow-muted)]">{plan.mode === "ai" ? "AI ช่วยจัด · โปรดตรวจเวลา" : "จัดในเครื่อง · ใช้งานได้โดยไม่ต้องมี AI API"}</p></div>
                    <span className="font-grotesk shrink-0 rounded-full bg-[var(--flow-lime)] px-2.5 py-1 text-[10px] font-bold text-[#111111]">{plan.mode === "ai" ? "AI" : "LOCAL"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 rounded-xl border border-[var(--flow-line)] p-1" role="tablist" aria-label="เลือกแผน">
                    {(["A", "B"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={variant === name} onClick={() => setVariant(name)} className={`min-h-11 rounded-lg text-sm font-semibold ${variant === name ? "bg-[var(--flow-ink)] text-[var(--flow-paper)]" : ""}`}>แผน {name}</button>)}
                  </div>
                  <ol className="mt-3 space-y-2">{activePlan.schedule.map((item, index) => <li key={`${item.taskId}-${index}`} className="grid grid-cols-[6.6rem_1fr] gap-2 rounded-xl bg-[var(--flow-surface)] px-3 py-2.5 text-sm"><span className="font-grotesk text-[var(--flow-lime-dark)]">{item.start}–{item.end}</span><strong>{item.title}</strong></li>)}</ol>
                  <p className="mt-3 flex items-center gap-2 text-sm text-[var(--flow-muted)]"><Clock3 size={16} aria-hidden />เวลาว่างโดยประมาณ {friendlyMinutes(activePlan.freeTimeMin)}</p>
                  <div className="mt-4"><ScoreCard controlScore={activePlan.controlScore} freeTimeMin={activePlan.freeTimeMin} tip={plan.tip} schedule={activePlan.schedule} riskPoints={activePlan.riskPoints} planLabel={`แผน ${variant}`} /></div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setPlan(null)} className="flow-press min-h-12 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 font-semibold">กลับไปแก้เงื่อนไข</button>
                    <button type="button" onClick={confirmPlan} className="flow-press flow-inverse min-h-12 rounded-xl px-3 font-semibold">ยืนยันแผนนี้</button>
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </div>

      {step < 4 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--flow-line)] bg-[color-mix(in_srgb,var(--flow-paper)_94%,transparent)] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
          <div className="mx-auto flex w-full max-w-[760px] gap-2">
            {step > 1 && <button type="button" onClick={() => setCurrentStep((step - 1) as GuideStep)} className="flow-press flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 font-semibold"><ArrowLeft size={17} aria-hidden />ย้อนกลับ</button>}
            <button
              type="button"
              onClick={() => step === 1 ? beginGuide() : setCurrentStep((step + 1) as GuideStep)}
              disabled={step === 3 && (!template || usefulDrafts.length === 0)}
              className="flow-press flow-inverse flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-xl px-4 font-semibold disabled:opacity-45"
            >
              {step === 3 ? "ใช้ฉบับร่างนี้" : "ต่อไป"}<ArrowRight size={17} className="text-[var(--flow-lime)]" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
