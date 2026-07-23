"use client";

import { useCallback, useId, useRef, useState } from "react";
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
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { FlowDialog } from "@/components/ui/flow-dialog";
import { EnergyLevelSelector, energyDescription } from "@/components/planner/EnergyLevelSelector";
import { LocationDisclosure } from "@/components/location/LocationDisclosure";
import { PlanningOverlay } from "@/components/PlanningOverlay";
import { ScoreCard } from "@/components/ScoreCard";
import { Timeline } from "@/components/Timeline";
import { ParsedTaskDraftSchema, type ParsedTaskDraft, type ParsedTasksResponse } from "@/lib/ai-parse";
import { controlBreakdown, freeTimeMin } from "@/lib/score";
import { findScheduleOverlaps, scheduleDurationMin } from "@/lib/schedule-validation";
import { timeToMinutes } from "@/lib/time";
import {
  hasCoordinates,
  taskLocationFromFlat,
  taskLocationToFlat,
  type TaskLocation,
} from "@/lib/location";
import type { PlaceSuggestion } from "@/lib/smart-places";
import type { AiMode, DayEnergy, PlanResult, PlanVariant, RecentPlace, SavedPlace, ScheduleItem, Task } from "@/lib/types";
import { trackProductEvent } from "@/lib/product-analytics";

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
  energyLevel: DayEnergy;
  startLocation?: TaskLocation;
};

export type PlannerAppendInput = {
  targetDate: string;
  drafts: PlannerDraftTask[];
};

export type PlannerApplyInput = PlannerGenerateInput & {
  /** Full day snapshot, including completed tasks that are excluded from planning. */
  allCurrentTasks: Task[];
  plan: PlanResult;
  variant: PlanVariantName;
};

export type AIPlannerDialogProps = {
  selectedDate: string;
  currentTasks: Task[];
  /** Supplies the single source-of-truth tasks when the user chooses another date. */
  getTasksForDate?: (date: string) => Task[];
  onTargetDateChange?: (date: string) => void;
  getEnergyForDate?: (date: string) => DayEnergy;
  onEnergyChange?: (date: string, energy: DayEnergy) => void;
  quickLocations?: readonly TaskLocation[];
  savedPlaces?: readonly SavedPlace[];
  recentPlaces?: readonly RecentPlace[];
  locationSuggestions?: readonly PlaceSuggestion[];
  locationRecommendationsEnabled?: boolean;
  onAddSavedPlace?: () => void;
  onEditSavedPlace?: (place: SavedPlace) => void;
  onPromoteRecentPlace?: (place: RecentPlace) => void;
  onClearRecentPlaces?: () => void;
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

type ScheduleArrivalConflict = {
  taskId: string;
  availableMin: number;
  requiredMin: number;
  kind: "travel" | "chronology" | "duration";
};

export function findScheduleArrivalConflicts(schedule: ScheduleItem[], dayStart: string, dayEnd: string) {
  const conflicts: ScheduleArrivalConflict[] = [];
  const startBoundary = timeToMinutes(dayStart);
  const crossesMidnight = timeToMinutes(dayEnd) <= startBoundary;
  let previousStart: number | null = null;
  let previousEnd = startBoundary;

  for (const item of schedule) {
    let start = timeToMinutes(item.start);
    if (crossesMidnight && start < startBoundary) start += 24 * 60;
    let end = timeToMinutes(item.end);
    if (crossesMidnight && end <= start) end += 24 * 60;

    if (!crossesMidnight && end <= start) {
      conflicts.push({ taskId: item.taskId, availableMin: 0, requiredMin: 0, kind: "duration" });
      end = start;
    }
    if ((!crossesMidnight && start < startBoundary) || (previousStart != null && start < previousStart)) {
      conflicts.push({ taskId: item.taskId, availableMin: 0, requiredMin: 0, kind: "chronology" });
    }

    const availableMin = Math.max(0, start - previousEnd);
    if (item.travelFromPrevMin > availableMin) {
      conflicts.push({ taskId: item.taskId, availableMin, requiredMin: item.travelFromPrevMin, kind: "travel" });
    }
    previousStart = start;
    previousEnd = Math.max(previousEnd, end);
  }
  return conflicts;
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
  return draft.title.trim().length > 0
    && Boolean(draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date))
    && (draft.durationMin == null || (Number.isInteger(draft.durationMin) && draft.durationMin >= 1 && draft.durationMin <= 24 * 60))
    && (!draft.lockTime || Boolean(draft.fixedTime));
}

function timeWindowLabel(label?: "morning" | "afternoon" | "evening" | "night") {
  if (!label) return "";
  return { morning: "ตอนเช้า", afternoon: "ตอนบ่าย", evening: "ตอนเย็น", night: "กลางคืน" }[label];
}

export function findDraftScheduleConflicts(drafts: PlannerDraftTask[], getTasks: (date: string) => Task[]) {
  const conflicts: string[] = [];
  const byDate = new Map<string, Array<{ title: string; start: number; end: number }>>();
  for (const draft of drafts) {
    const date = draft.date;
    if (!date || !draft.fixedTime || draft.durationMin == null) continue;
    const existing = byDate.get(date) ?? getTasks(date)
      .filter((task) => task.fixedTime && task.durationMin != null)
      .map((task) => ({ title: task.title, start: timeToMinutes(task.fixedTime!), end: timeToMinutes(task.fixedTime!) + task.durationMin! }));
    const start = timeToMinutes(draft.fixedTime);
    const end = start + draft.durationMin;
    const overlap = existing.find((slot) => start < slot.end && end > slot.start);
    if (overlap) conflicts.push(`${draft.title} ทับกับ ${overlap.title}`);
    existing.push({ title: draft.title, start, end });
    byDate.set(date, existing);
  }
  return conflicts;
}

export function AIPlannerDialog({
  selectedDate,
  currentTasks,
  getTasksForDate,
  onTargetDateChange,
  getEnergyForDate,
  onEnergyChange,
  quickLocations = [],
  savedPlaces = [],
  recentPlaces = [],
  locationSuggestions = [],
  locationRecommendationsEnabled = true,
  onAddSavedPlace,
  onEditSavedPlace,
  onPromoteRecentPlace,
  onClearRecentPlaces,
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
  const settingsRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [targetDate, setTargetDate] = useState(selectedDate);
  const [energyLevel, setEnergyLevel] = useState<DayEnergy>(() => getEnergyForDate?.(selectedDate) ?? "medium");
  const [startLocation, setStartLocation] = useState<TaskLocation | null>(null);
  const [dayStart, setDayStart] = useState("08:00");
  const [dayEnd, setDayEnd] = useState("22:00");
  const [breakMinutes, setBreakMinutes] = useState(30);
  const [drafts, setDrafts] = useState<PlannerDraftTask[]>([]);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [variantName, setVariantName] = useState<PlanVariantName>("A");
  const [mode, setMode] = useState<AiMode>(preferredMode);
  const [hasParsed, setHasParsed] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [draggedDraft, setDraggedDraft] = useState<number | null>(null);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [pendingLocationKeys, setPendingLocationKeys] = useState<Set<string>>(() => new Set());

  const activeVariant = plan?.plans[variantName] ?? null;
  const activeOverlaps = activeVariant ? findScheduleOverlaps(activeVariant.schedule) : [];
  const activeArrivalConflicts = activeVariant ? findScheduleArrivalConflicts(activeVariant.schedule, dayStart, dayEnd) : [];
  const activeTravelConflicts = activeArrivalConflicts.filter((conflict) => conflict.kind === "travel");
  const activeChronologyConflicts = activeArrivalConflicts.filter((conflict) => conflict.kind !== "travel");
  const requiresRiskAcceptance = activeOverlaps.length > 0 || activeArrivalConflicts.length > 0;
  const sourceTasks = getTasksForDate?.(targetDate) ?? currentTasks;
  const targetTasks = sourceTasks.filter((task) => !task.done);
  const lockedTaskIds = new Set([
    ...targetTasks.filter((task) => task.lockTime && task.fixedTime).map((task) => task.id),
    ...drafts.filter((draft) => draft.lockTime && draft.fixedTime).map((draft) => `ai-draft-${draft.draftId}`),
  ]);
  const plannerStartLocations = quickLocations.filter(hasCoordinates);
  const locationBusy = pendingLocationKeys.size > 0;
  const disabled = busy !== null || locationBusy;
  const setLocationBusy = useCallback((key: string, isBusy: boolean) => {
    setPendingLocationKeys((current) => {
      const alreadySet = current.has(key);
      if (alreadySet === isBusy) return current;
      const next = new Set(current);
      if (isBusy) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

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
    const conflicts = findDraftScheduleConflicts(
      drafts,
      (date) => getTasksForDate?.(date) ?? (date === targetDate ? currentTasks : []),
    );
    if (conflicts.length) return `พบเวลาชน ${conflicts.length} รายการ: ${conflicts.slice(0, 2).join(" · ")} กรุณาแก้เวลา หรือปล่อยให้ Flow จัดเวลา`;
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
    setParseWarnings([]);
    trackProductEvent("bulk_text_parse_started");
    try {
      const response = await onParse({ text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes });
      if (operation !== operationRef.current) return;
      const nextDrafts = response.tasks.map((task) => {
        const parsedTask = ParsedTaskDraftSchema.parse(task);
        return { ...parsedTask, date: parsedTask.date ?? response.date ?? targetDate, draftId: newDraftId() };
      });
      setDrafts(nextDrafts);
      setMode(response.mode);
      setHasParsed(true);
      setParseWarnings(response.warnings ?? []);
      if (response.date && response.date !== targetDate) {
        setTargetDate(response.date);
        setEnergyLevel(getEnergyForDate?.(response.date) ?? "medium");
        onTargetDateChange?.(response.date);
      }
      setPlan(null);
      setNotice(nextDrafts.length ? `สร้างฉบับร่าง ${nextDrafts.length} งานแล้ว ยังไม่มีการบันทึก` : "ไม่พบงานจากข้อความ กรุณาลองระบุงานและเวลาให้ชัดขึ้น");
      trackProductEvent("bulk_text_parse_succeeded", {
        itemCount: nextDrafts.length,
        parserMode: response.mode,
        hasAmbiguousItems: nextDrafts.some((draft) => draft.needsReview),
        hasLocation: nextDrafts.some((draft) => Boolean(draft.place)),
        hasFixedTimes: nextDrafts.some((draft) => Boolean(draft.fixedTime)),
        requiredPlanner: nextDrafts.some((draft) => !draft.fixedTime && draft.durationMin != null),
        success: nextDrafts.length > 0,
      });
    } catch (reason) {
      if (operation !== operationRef.current) return;
      setError(reason instanceof Error && reason.message ? reason.message : "ยังแปลงข้อความไม่ได้ กรุณาลองอีกครั้ง");
      trackProductEvent("bulk_text_parse_failed", { success: false });
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  };

  const updateDraft = (draftId: string, patch: Partial<PlannerDraftTask>) => {
    setDrafts((current) => current.map((draft) => draft.draftId === draftId ? { ...draft, ...patch } : draft));
    setPlan(null);
    clearFeedback();
    trackProductEvent("bulk_text_preview_edited");
  };

  const moveDraft = (from: number, to: number) => {
    setDrafts((current) => reorder(current, from, to));
    setPlan(null);
  };

  const addBreakDraft = () => {
    setDrafts((current) => [...current, {
      draftId: newDraftId("break"),
      title: "พัก",
      date: targetDate,
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
    if (locationBusy) { setError("กรุณารอให้ค้นหาตำแหน่งเสร็จก่อนจัดแผน"); return; }
    const validationError = validateSettings() || validateDrafts();
    if (validationError) { setError(validationError); return; }
    const hasSchedulableTask = targetTasks.some((task) => task.durationMin != null)
      || drafts.some((draft) => (draft.date ?? targetDate) === targetDate && draft.durationMin != null);
    if (!hasSchedulableTask) { setError("ยังไม่มีงานที่ระบุระยะเวลาสำหรับจัดแผน คุณยังบันทึกงานไว้รอ AI ประเมินได้"); return; }

    const operation = ++operationRef.current;
    setBusy("plan");
    try {
      const response = await onGeneratePlan({
        text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes, currentTasks: targetTasks, drafts, energyLevel, startLocation: startLocation ?? undefined,
      });
      if (operation !== operationRef.current) return;
      setPlan(response);
      setVariantName("A");
      setMode(response.mode ?? preferredMode);
      setRiskAccepted(false);
      setNotice("สร้างแผน A และ B แล้ว ตรวจสอบก่อนบันทึก");
      trackProductEvent("bulk_text_planner_used", { parserMode: mode, itemCount: drafts.length, success: true });
    } catch (reason) {
      if (operation !== operationRef.current) return;
      setError(reason instanceof Error && reason.message ? reason.message : "ยังจัดแผนไม่ได้ กรุณาลองอีกครั้ง");
    } finally {
      if (operation === operationRef.current) setBusy(null);
    }
  };

  const appendDrafts = async () => {
    clearFeedback();
    if (locationBusy) { setError("กรุณารอให้ค้นหาตำแหน่งเสร็จก่อนบันทึกงาน"); return; }
    const validationError = validateSettings() || validateDrafts();
    if (validationError) { setError(validationError); return; }
    if (!drafts.length) { setError("ยังไม่มีงานฉบับร่างให้บันทึก"); return; }
    setBusy("append");
    try {
      await onAppendDrafts({ targetDate, drafts });
      setNotice(`เพิ่ม ${drafts.length} งานแล้ว โดยคงงานเดิมทั้งหมด`);
      trackProductEvent("bulk_text_tasks_confirmed", { itemCount: drafts.length, parserMode: mode, success: true });
      trackProductEvent("bulk_text_tasks_created", { itemCount: drafts.length, parserMode: mode, success: true });
      window.setTimeout(onClose, 450);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "บันทึกงานไม่ได้ กรุณาลองอีกครั้ง");
      setBusy(null);
    }
  };

  const updateSchedule = (updater: (schedule: ScheduleItem[]) => ScheduleItem[], invalidateTravel = false) => {
    if (!plan) return;
    const variant = plan.plans[variantName];
    const updated = updater(variant.schedule);
    const schedule = invalidateTravel
      ? updated.map((item) => ({ ...item, travelFromPrevMin: 0 }))
      : updated;
    let nextVariant = refreshVariant(variant, schedule);
    if (invalidateTravel) {
      const warning = "มีการเปลี่ยนลำดับรายการหลังคำนวณเส้นทาง ระบบจึงล้างเวลาเดินทางเดิมแทนการเดาค่า กรุณากดจัดใหม่เพื่อคำนวณเส้นทางอีกครั้ง";
      const riskPoints = [
        ...nextVariant.riskPoints.filter((risk) => !risk.reason.includes("เดินทาง") && !risk.reason.includes("เส้นทาง")),
        { time: "การเดินทาง", reason: warning },
      ];
      nextVariant = { ...nextVariant, riskPoints, riskScore: Math.max(nextVariant.riskScore, Math.min(100, riskPoints.length * 20)) };
    }
    setPlan({ ...plan, plans: { ...plan.plans, [variantName]: nextVariant } });
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
    }], true);
  };

  const applyPlan = async () => {
    if (!plan) return;
    clearFeedback();
    if (requiresRiskAcceptance && !riskAccepted) { setError("แผนยังมีเวลาทับกัน ลำดับเวลาย้อนกลับ หรือเดินทางไม่ทัน โปรดยืนยันว่าได้รับทราบก่อนบันทึก"); return; }
    setBusy("apply");
    try {
      await onApplyPlan({
        text: text.trim(), targetDate, dayStart, dayEnd, breakMinutes, currentTasks: targetTasks, allCurrentTasks: sourceTasks, drafts, energyLevel, startLocation: startLocation ?? undefined, plan, variant: variantName,
      });
      setNotice(`บันทึกแผน ${variantName} แล้ว`);
      trackProductEvent("bulk_text_tasks_confirmed", { itemCount: drafts.length, parserMode: mode, requiredPlanner: true, success: true });
      trackProductEvent("bulk_text_tasks_created", { itemCount: drafts.length, parserMode: mode, requiredPlanner: true, success: true });
      window.setTimeout(onClose, 450);
    } catch (reason) {
      setError(reason instanceof Error && reason.message ? reason.message : "บันทึกแผนไม่ได้ กรุณาลองอีกครั้ง");
      setBusy(null);
    }
  };

  return (
    <>
      <FlowDialog title="เปลี่ยนข้อความเป็นแผน" description="พิมพ์หลายงาน ตรวจฉบับร่าง แล้วจึงเลือกบันทึกหรือให้ Flow จัดเวลา" onClose={closeWithoutSaving}>
        <div className="flow-planner-dialog space-y-4" data-theme-scope="ai-planner">
          <section className="flow-planner-status rounded-2xl p-4" aria-label="สถานะระบบวางแผน" data-testid="planner-system-status">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles size={17} className="text-[var(--flow-lime)]" aria-hidden />วางทั้งงาน เวลา และช่วงพัก</div>
                <p className="flow-planner-status-secondary mt-1 text-xs leading-5">ตรวจและแก้ฉบับร่างได้ก่อนบันทึก งานเดิมที่ไม่อยู่ในแผนจะไม่ถูกลบ</p>
              </div>
              <span className="font-grotesk shrink-0 rounded-full bg-[var(--flow-accent)] px-2.5 py-1 text-[10px] font-bold text-[var(--flow-accent-foreground)]" aria-label={hasParsed ? `กำลังใช้ ${modeLabel(mode)}` : "พร้อมเลือกตัวแยกข้อความที่ใช้งานได้"}>{hasParsed ? modeLabel(mode) : "READY"}</span>
            </div>
            <p className="flow-planner-status-secondary mt-3 border-t border-[var(--flow-border-default)] pt-3 text-[11px] leading-5">
              {hasParsed ? mode === "ai" ? "AI ช่วยตีความและจัดตาราง โปรดตรวจผลลัพธ์ก่อนใช้จริง" : "โหมด Local จัดแผนในเครื่องแบบ deterministic เมื่อไม่มี AI API" : "เมื่อกดแปลง ระบบจะใช้ AI หากพร้อม หรือใช้ตัวแยกข้อความภายในโดยอัตโนมัติ"}
            </p>
          </section>

          <form ref={settingsRef} onSubmit={parseText} aria-describedby={error ? errorId : undefined} className="space-y-3">
            <label className="block text-sm font-semibold" htmlFor="planner-request">บอกงานและข้อจำกัดของคุณ</label>
            <textarea
              id="planner-request"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              disabled={disabled}
              placeholder="เช่น พรุ่งนี้ตื่น 9 โมง อาบน้ำครึ่งชั่วโมง ดูหนังรอบ 12:30 ที่สยาม กลับบ้าน 4 โมง แล้วทำรายงาน 2 ชั่วโมงตอนเย็น"
              className="min-h-28 w-full resize-y rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 py-3 text-sm leading-6 outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-60"
            />

            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-xs font-semibold" htmlFor="planner-date"><CalendarDays size={14} className="mr-1 inline" aria-hidden />วันที่จัดแผน</label>
              <input id="planner-date" type="date" required value={targetDate} onChange={(event) => { const nextDate = event.target.value; setTargetDate(nextDate); setEnergyLevel(getEnergyForDate?.(nextDate) ?? "medium"); setDrafts([]); setHasParsed(false); setStartLocation(null); setPlan(null); setError(""); setNotice("เปลี่ยนวันที่แล้ว กรุณาตรวจงานและจุดเริ่มต้นอีกครั้ง"); onTargetDateChange?.(nextDate); }} disabled={disabled} className="font-grotesk col-span-2 min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <label className="text-xs font-semibold" htmlFor="planner-start"><Clock3 size={14} className="mr-1 inline" aria-hidden />เริ่มวัน</label>
              <label className="text-xs font-semibold" htmlFor="planner-end">สิ้นสุดวัน</label>
              <input id="planner-start" type="time" required value={dayStart} onChange={(event) => { setDayStart(event.target.value); setPlan(null); }} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <input id="planner-end" type="time" required value={dayEnd} onChange={(event) => { setDayEnd(event.target.value); setPlan(null); }} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
              <label className="col-span-2 text-xs font-semibold" htmlFor="planner-break"><Coffee size={14} className="mr-1 inline" aria-hidden />เวลาพักเริ่มต้น (นาที)</label>
              <input id="planner-break" type="number" min={15} max={240} step={15} required value={breakMinutes} onChange={(event) => { setBreakMinutes(Number(event.target.value)); setPlan(null); }} disabled={disabled} className="font-grotesk col-span-2 min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
            </div>

            <LocationDisclosure
              key={targetDate}
              title="จุดเริ่มต้นวันนี้"
              description="ใช้เป็นต้นทางของงานแรกและช่วยลดการเดินทางย้อนกลับ ตำแหน่งนี้อยู่เฉพาะใน Planner และจะไม่ติดตามเบื้องหลัง"
              value={startLocation}
              quickLocations={plannerStartLocations}
              savedPlaces={savedPlaces}
              recentPlaces={recentPlaces}
              suggestions={locationSuggestions}
              recommendationsEnabled={locationRecommendationsEnabled}
              onAddSavedPlace={onAddSavedPlace}
              onEditSavedPlace={onEditSavedPlace}
              onPromoteRecentPlace={onPromoteRecentPlace}
              onClearRecent={onClearRecentPlaces}
              disabled={disabled}
              defaultExpanded
              onBusyChange={(isBusy) => setLocationBusy("planner-origin", isBusy)}
              onChange={(nextLocation) => {
                setStartLocation(nextLocation);
                setPlan(null);
                clearFeedback();
              }}
            />

            <EnergyLevelSelector
              value={energyLevel}
              disabled={disabled}
              onChange={(nextEnergy) => {
                setEnergyLevel(nextEnergy);
                onEnergyChange?.(targetDate, nextEnergy);
                setPlan(null);
                clearFeedback();
              }}
            />

            <button type="submit" disabled={disabled || !text.trim()} className="flow-press flow-inverse flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-45">
              {busy === "parse" ? <LoaderCircle size={18} className="animate-spin text-[var(--flow-lime)]" aria-hidden /> : <Bot size={18} className="text-[var(--flow-lime)]" aria-hidden />}
              {busy === "parse" ? "กำลังสร้างฉบับร่าง" : "แปลงข้อความเป็นฉบับร่าง"}
            </button>
          </form>

          {(error || notice) && (
            <div id={errorId} role={error ? "alert" : "status"} aria-live="polite" className={`rounded-xl border-[1.5px] px-3 py-2.5 text-sm ${error ? "flow-danger-panel" : "border-[var(--flow-border-strong)] bg-[var(--flow-accent)] text-[var(--flow-accent-foreground)]"}`}>
              {error || notice}
            </div>
          )}
          {parseWarnings.length > 0 && (
            <ul role="status" className="flow-warning-panel space-y-1 rounded-xl px-3 py-2.5 text-xs">
              {parseWarnings.map((warning) => <li key={warning}>• {warning}</li>)}
            </ul>
          )}

          <section className="border-t flow-hairline pt-4" aria-labelledby="planner-draft-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 id="planner-draft-heading" className="font-semibold">ฉบับร่างก่อนบันทึก</h3>
                <p className="mt-0.5 text-xs text-[var(--flow-muted)]">งานเดิม {targetTasks.length} รายการ · งานใหม่ {drafts.length} รายการ</p>
              </div>
              <button type="button" onClick={addBreakDraft} disabled={disabled} className="flow-press flex min-h-11 items-center gap-1.5 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 text-xs font-semibold disabled:opacity-45"><Plus size={15} aria-hidden />เพิ่มเวลาพัก</button>
            </div>

            {targetTasks.length > 0 && (
              <div className="mt-3 rounded-2xl border-[1.5px] border-[var(--flow-line)] p-3">
                <h4 className="text-sm font-semibold">งานที่จะนำไปจัด</h4>
                <ul className="mt-2 space-y-1.5" aria-label="งานเดิมที่จะนำไปจัดแผน">
                  {targetTasks.map((task) => (
                    <li key={task.id} className="flex min-w-0 items-start justify-between gap-2 rounded-xl bg-[var(--flow-surface)] px-3 py-2 text-xs">
                      <span className="min-w-0"><strong className="block truncate">{task.title}</strong><span className="text-[var(--flow-muted)]">{task.fixedTime ? `เริ่ม ${task.fixedTime}` : "ให้ AI จัดเวลา"} · {task.durationMin ? `${task.durationMin} นาที` : "รอ AI ประเมิน"}{task.place ? ` · ${task.place}` : ""}</span></span>
                      {task.lockTime && task.fixedTime && <span className="shrink-0 rounded-full border border-[var(--flow-ink)] px-2 py-0.5 font-semibold">ล็อกเวลา</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                      <label className="col-span-2 text-xs font-semibold" htmlFor={`${draft.draftId}-date`}>วันที่</label>
                      <input id={`${draft.draftId}-date`} type="date" required value={draft.date ?? targetDate} onChange={(event) => updateDraft(draft.draftId, { date: event.target.value })} disabled={disabled} className="font-grotesk col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <label className="text-xs font-semibold" htmlFor={`${draft.draftId}-time`}>เวลาเริ่ม</label>
                      <label className="text-xs font-semibold" htmlFor={`${draft.draftId}-duration`}>ระยะเวลา</label>
                      <input id={`${draft.draftId}-time`} type="time" value={draft.fixedTime ?? ""} onChange={(event) => updateDraft(draft.draftId, { fixedTime: event.target.value || undefined, lockTime: event.target.value ? draft.lockTime : false, allDay: false })} disabled={disabled} className="font-grotesk min-h-11 min-w-0 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <div className="relative"><input id={`${draft.draftId}-duration`} aria-describedby={`${draft.draftId}-duration-help`} type="number" min={1} max={1440} step={15} value={draft.durationMin ?? ""} placeholder="ให้ AI ประเมิน" onChange={(event) => updateDraft(draft.draftId, { durationMin: event.target.value ? Number(event.target.value) : undefined, durationSource: event.target.value ? "explicit" : "unknown" })} disabled={disabled} className="font-grotesk min-h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" /><span className="pointer-events-none absolute right-3 top-3 text-xs text-[var(--flow-muted)]">นาที</span></div>
                      <p id={`${draft.draftId}-duration-help`} className="col-span-2 text-xs text-[var(--flow-muted)]">{draft.durationMin == null ? "รอ AI ประเมิน — ระบบจะไม่สมมติเป็น 60 นาที" : `ระยะเวลาจาก ${draft.durationSource === "explicit" ? "ข้อความ/ผู้ใช้" : "ข้อเสนอของระบบ"}`}</p>
                      <label className="col-span-2 flex min-h-11 items-center gap-2 text-xs font-semibold"><input type="checkbox" checked={draft.lockTime} disabled={disabled || !draft.fixedTime} onChange={(event) => updateDraft(draft.draftId, { lockTime: event.target.checked })} className="h-5 w-5 accent-[var(--flow-lime-dark)]" />ล็อกเวลาเริ่มนี้ (Flow ห้ามเลื่อน)</label>
                      <label className="col-span-2 text-xs font-semibold" htmlFor={`${draft.draftId}-priority`}>ความสำคัญ</label>
                      <select id={`${draft.draftId}-priority`} value={draft.priority} onChange={(event) => updateDraft(draft.draftId, { priority: event.target.value as PlannerDraftTask["priority"] })} disabled={disabled} className="col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]"><option value="urgent">ด่วน</option><option value="high">สำคัญมาก</option><option value="normal">ปกติ</option><option value="flex">ยืดได้</option></select>
                    </div>
                    <div className="mt-2">
                      <LocationDisclosure
                        title="ที่ไหน"
                        description="ค้นหา เลือกหมุด หรือใช้ตำแหน่งปัจจุบัน เพื่อให้เส้นทางของงานฉบับร่างนี้มีพิกัดจริง"
                        value={taskLocationFromFlat(draft)}
                        quickLocations={quickLocations}
                        savedPlaces={savedPlaces}
                        recentPlaces={recentPlaces}
                        suggestions={locationSuggestions}
                        recommendationsEnabled={locationRecommendationsEnabled}
                        onAddSavedPlace={onAddSavedPlace}
                        onEditSavedPlace={onEditSavedPlace}
                        onPromoteRecentPlace={onPromoteRecentPlace}
                        onClearRecent={onClearRecentPlaces}
                        disabled={disabled}
                        onBusyChange={(isBusy) => setLocationBusy(`draft-${draft.draftId}`, isBusy)}
                        onChange={(location) => updateDraft(draft.draftId, taskLocationToFlat(location))}
                      />
                    </div>
                    {draft.timeWindow?.label && <p className="mt-2 text-xs text-[var(--flow-muted)]">ช่วงเวลาที่ต้องการ: {timeWindowLabel(draft.timeWindow.label)}{draft.timeWindow.start && draft.timeWindow.end ? ` (${draft.timeWindow.start}–${draft.timeWindow.end})` : ""}</p>}
                    {draft.sourceText && <details className="mt-2 text-xs text-[var(--flow-muted)]"><summary className="cursor-pointer font-semibold">ข้อความต้นฉบับของรายการนี้</summary><p className="mt-1 break-words rounded-lg bg-[var(--flow-surface)] p-2">{draft.sourceText}</p></details>}
                    {draft.needsReview && <p className="flow-warning-panel mt-2 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-xs"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{draft.reviewReason || draft.note || "ข้อมูลเวลายังไม่ครบ กรุณาตรวจสอบก่อนยืนยัน"}</p>}
                  </li>
                ))}
              </ol>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={appendDrafts} disabled={disabled || drafts.length === 0} className="flow-press min-h-12 rounded-2xl border-[1.5px] border-[var(--flow-line)] px-3 text-sm font-semibold disabled:opacity-40">{busy === "append" ? "กำลังบันทึก" : `เพิ่ม ${drafts.length} งานลง Timeline`}</button>
              <button type="button" onClick={generatePlan} disabled={disabled || (!targetTasks.some((task) => task.durationMin != null) && !drafts.some((draft) => draft.durationMin != null))} className="flow-press min-h-12 rounded-2xl bg-[var(--flow-accent)] px-3 text-sm font-semibold text-[var(--flow-accent-foreground)] disabled:opacity-40">{busy === "plan" ? "กำลังจัดแผน" : `จัดเวลาและเพิ่ม ${drafts.length || targetTasks.length} งาน`}</button>
            </div>
            {drafts.length > 0 && <button type="button" onClick={() => { settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); document.getElementById("planner-request")?.focus(); }} className="flow-press mt-2 min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--flow-muted)] underline decoration-[var(--flow-lime-dark)] decoration-2 underline-offset-4">กลับไปแก้ข้อความ</button>}
          </section>

          {plan && activeVariant && (
            <section className="border-t flow-hairline pt-4" aria-labelledby="planner-result-heading">
              <div className="flex items-start justify-between gap-3">
                <div><h3 id="planner-result-heading" className="font-semibold">ตรวจแผนก่อนบันทึก</h3><p className="mt-0.5 text-xs text-[var(--flow-muted)]">ตรวจลำดับ แล้วแก้เวลา ชื่อ หรือลบรายการออกจากแผนได้</p></div>
                <span className="font-grotesk rounded-full border border-[var(--flow-line)] px-2 py-1 text-[10px] font-bold">{modeLabel(plan.mode ?? mode)}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 rounded-xl border-[1.5px] border-[var(--flow-line)] p-1" role="tablist" aria-label="เลือกฉบับแผน">
                {(["A", "B"] as const).map((name) => <button key={name} type="button" role="tab" aria-selected={variantName === name} onClick={() => { setVariantName(name); setRiskAccepted(false); }} className={`flow-press min-h-11 rounded-lg text-sm font-semibold ${variantName === name ? "flow-inverse" : "text-[var(--flow-muted)]"}`}>แผน {name}</button>)}
              </div>

              <div className="mt-3 space-y-2 rounded-xl bg-[var(--flow-surface)] p-3 text-xs leading-5 text-[var(--flow-muted)]">
                <p>{plan.summary}</p>
                <p><strong>ผลจากพลังงานวันนี้:</strong> {energyDescription(energyLevel)}</p>
                {!hasCoordinates(startLocation) && <p className="flex items-start gap-1.5 text-[var(--flow-warning)]"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /><span>ไม่ได้ระบุจุดเริ่มต้นที่มีพิกัด ลำดับงานยังจัดได้ แต่เวลาเดินทางขาแรกอาจไม่แม่นยำ</span></p>}
              </div>

              <ol className="mt-3 space-y-2" aria-label={`แก้รายการแผน ${variantName}`}>
                {activeVariant.schedule.map((item, index) => {
                  const locked = lockedTaskIds.has(item.taskId);
                  return (
                  <li key={`${item.taskId}-${index}`} className="rounded-xl border border-[var(--flow-line)] p-2.5">
                    <div className="flex items-center gap-1">
                      <span className="font-grotesk mr-auto text-[10px] font-bold text-[var(--flow-muted)]">{item.start}–{item.end}{locked ? " · ล็อก" : ""}</span>
                      <button type="button" onClick={() => updateSchedule((items) => items.filter((_, itemIndex) => itemIndex !== index), true)} disabled={locked} className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)] disabled:opacity-30" aria-label={`ลบ ${item.title} จากแผน`}><Trash2 size={15} aria-hidden /></button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="sr-only" htmlFor={`plan-${variantName}-${index}-title`}>ชื่องาน</label>
                      <input id={`plan-${variantName}-${index}-title`} value={item.title} onChange={(event) => updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, title: event.target.value } : current))} className="col-span-2 min-h-11 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)]" />
                      <label className="text-xs font-semibold" htmlFor={`plan-${variantName}-${index}-start`}>เวลาเริ่ม
                        <input id={`plan-${variantName}-${index}-start`} type="time" value={item.start} disabled={locked} onChange={(event) => {
                          const durationMin = scheduleDurationMin(item.start, item.end);
                          updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, start: event.target.value, end: addMinutes(event.target.value, durationMin) } : current));
                        }} className="font-grotesk mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--flow-line)] px-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-60" />
                      </label>
                      <label className="text-xs font-semibold" htmlFor={`plan-${variantName}-${index}-duration`}>ระยะเวลา
                        <span className="relative mt-1 block"><input id={`plan-${variantName}-${index}-duration`} type="number" min={1} max={1440} value={scheduleDurationMin(item.start, item.end)} disabled={locked} onChange={(event) => {
                          const durationMin = Number(event.target.value);
                          if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 1440) return;
                          updateSchedule((items) => items.map((current, itemIndex) => itemIndex === index ? { ...current, end: addMinutes(current.start, durationMin) } : current));
                        }} className="font-grotesk min-h-11 w-full min-w-0 rounded-xl border border-[var(--flow-line)] px-3 pr-12 outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-60" /><span className="pointer-events-none absolute right-3 top-3 text-xs font-normal text-[var(--flow-muted)]">นาที</span></span>
                      </label>
                      <p className="col-span-2 text-xs text-[var(--flow-muted)]">สิ้นสุดโดยประมาณ <span className="font-grotesk">{item.end}</span> น. (คำนวณจากเวลาเริ่ม + ระยะเวลา)</p>
                    </div>
                  </li>
                );})}
              </ol>

              <button type="button" onClick={addBreakToSchedule} className="flow-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[var(--flow-line)] text-sm font-semibold"><Coffee size={16} aria-hidden />เพิ่มช่วงพัก {breakMinutes} นาทีในแผน</button>

              <div className="mt-4"><ScoreCard controlScore={activeVariant.controlScore} freeTimeMin={activeVariant.freeTimeMin} tip={plan.tip} schedule={activeVariant.schedule} riskPoints={activeVariant.riskPoints} planLabel={`แผน ${variantName}`} altPlan={{ label: `แผน ${variantName === "A" ? "B" : "A"}`, score: plan.plans[variantName === "A" ? "B" : "A"].controlScore, onSwitch: () => { setVariantName(variantName === "A" ? "B" : "A"); setRiskAccepted(false); } }} /></div>
              <div className="mt-4"><Timeline items={activeVariant.schedule} riskPoints={activeVariant.riskPoints} /></div>

              {requiresRiskAcceptance && (
                <label className="flow-danger-panel mt-3 flex min-h-12 cursor-pointer items-start gap-2 rounded-xl border-[1.5px] p-3 text-sm">
                  <input type="checkbox" checked={riskAccepted} onChange={(event) => setRiskAccepted(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--flow-lime-dark)]" />
                  <span><strong>พบความเสี่ยงที่ต้องยืนยัน</strong><br /><span className="text-xs">เวลาทับกัน {activeOverlaps.length} จุด · ลำดับ/ช่วงเวลาไม่ถูกต้อง {activeChronologyConflicts.length} จุด · เดินทางไม่ทัน {activeTravelConflicts.length} ช่วง ฉันตรวจสอบแล้วและต้องการบันทึกแผนนี้</span></span>
                </label>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={generatePlan} disabled={disabled} className="flow-press min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 text-sm font-semibold disabled:opacity-40">จัดใหม่</button>
                <button type="button" onClick={() => { settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); settingsRef.current?.querySelector<HTMLElement>("input,textarea,button")?.focus(); }} disabled={disabled} className="flow-press min-h-11 rounded-xl border-[1.5px] border-[var(--flow-line)] px-3 text-sm font-semibold disabled:opacity-40">กลับไปแก้เงื่อนไข</button>
              </div>
              <button type="button" onClick={applyPlan} disabled={disabled || !activeVariant.schedule.length || (requiresRiskAcceptance && !riskAccepted)} className="flow-press flow-inverse mt-2 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl px-4 font-semibold disabled:opacity-40">{busy === "apply" ? <LoaderCircle size={18} className="animate-spin text-[var(--flow-lime)]" aria-hidden /> : <Sparkles size={18} className="text-[var(--flow-lime)]" aria-hidden />}{busy === "apply" ? "กำลังบันทึกแผน" : `ใช้แผน ${variantName} นี้`}</button>
            </section>
          )}

          <button type="button" onClick={closeWithoutSaving} disabled={busy === "append" || busy === "apply"} className="flow-press min-h-11 w-full rounded-xl text-sm font-semibold text-[var(--flow-muted)] disabled:opacity-40">ยกเลิกโดยไม่บันทึก</button>
        </div>
      </FlowDialog>
      <PlanningOverlay open={busy === "plan"} taskCount={targetTasks.length + drafts.length} onCancel={() => { operationRef.current += 1; onCancelPending?.(); setBusy(null); setError("ยกเลิกการจัดแผนแล้ว ยังไม่มีการบันทึก"); }} />
    </>
  );
}
