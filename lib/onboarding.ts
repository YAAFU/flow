import { z } from "zod";
import type { StorageLike } from "@/lib/storage";
import {
  DayEnergySchema,
  IsoDateSchema,
  PrioritySchema,
  TimeSchema,
} from "@/lib/types";

/**
 * Keep the existing key so every v2 installation is migrated in place. The
 * schemaVersion inside the value, not a second localStorage key, owns upgrades.
 */
export const ONBOARDING_KEY = "flow_onboarding_v2";
export const LEGACY_ONBOARDING_KEY = "flow_onboarding_v1";
export const LEGACY_TOUR_KEY = "flow_tour_seen";
export const PRODUCT_GUIDE_VERSION = 2 as const;
export const ONBOARDING_SCHEMA_VERSION = 4 as const;
export const ONBOARDING_STEP_COUNT = 3 as const;

export const GuidanceStatusSchema = z.enum([
  "not_started",
  "started",
  "skipped",
  "completed",
]);
export const TourStatusSchema = z.enum(["not_started", "skipped", "completed"]);
export const QuickStartStageSchema = z.enum(["add_task", "schedule_task", "completed"]);
export const OnboardingStatusSchema = GuidanceStatusSchema;

export const OnboardingTemplateSchema = z.enum([
  "school",
  "work",
  "project",
  "blank",
]);

export const OnboardingDraftItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  durationMin: z.number().int().min(15).max(8 * 60).optional(),
  fixedTime: TimeSchema.optional(),
  priority: PrioritySchema.default("normal"),
});

export const OnboardingDraftSchema = z.object({
  date: IsoDateSchema,
  dayStart: TimeSchema.default("08:00"),
  dayEnd: TimeSchema.default("20:00"),
  energy: DayEnergySchema.default("medium"),
  items: z.array(OnboardingDraftItemSchema).max(20).default([]),
});

export const ProductGuideStateSchema = z.object({
  version: z.literal(PRODUCT_GUIDE_VERSION),
  status: GuidanceStatusSchema,
  currentStep: z.number().int().min(1).max(ONBOARDING_STEP_COUNT),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const QuickStartStateSchema = z.object({
  status: GuidanceStatusSchema,
  stage: QuickStartStageSchema,
  taskId: z.string().trim().min(1).max(160).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const TourStateSchema = z.object({
  coreStatus: TourStatusSchema,
  fullStatus: TourStatusSchema,
});

export const SampleDayStateSchema = z.object({
  selectedTemplate: OnboardingTemplateSchema.nullable(),
  draft: OnboardingDraftSchema.nullable(),
});

export const OnboardingStateSchema = z.object({
  schemaVersion: z.literal(ONBOARDING_SCHEMA_VERSION),
  productGuide: ProductGuideStateSchema,
  quickStart: QuickStartStateSchema,
  tour: TourStateSchema,
  sampleDay: SampleDayStateSchema,
  updatedAt: z.string().datetime(),
});

export type OnboardingStatus = z.infer<typeof GuidanceStatusSchema>;
export type OnboardingTemplate = z.infer<typeof OnboardingTemplateSchema>;
export type SelectedOnboardingTemplate = OnboardingTemplate;
export type OnboardingDraftItem = z.infer<typeof OnboardingDraftItemSchema>;
export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;
export type ProductGuideState = z.infer<typeof ProductGuideStateSchema>;
export type QuickStartState = z.infer<typeof QuickStartStateSchema>;
export type QuickStartStage = z.infer<typeof QuickStartStageSchema>;
export type TourStatus = z.infer<typeof TourStatusSchema>;
export type OnboardingState = z.infer<typeof OnboardingStateSchema>;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeIso(value: unknown): string | undefined {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return undefined;
  return new Date(value).toISOString();
}

function safeNow(now: Date): string {
  return Number.isFinite(now.getTime()) ? now.toISOString() : new Date(0).toISOString();
}

export function createDefaultOnboardingState(now = new Date()): OnboardingState {
  return {
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    productGuide: {
      version: PRODUCT_GUIDE_VERSION,
      status: "not_started",
      currentStep: 1,
    },
    quickStart: { status: "not_started", stage: "add_task" },
    tour: { coreStatus: "not_started", fullStatus: "not_started" },
    sampleDay: { selectedTemplate: null, draft: null },
    updatedAt: safeNow(now),
  };
}

function normalizeStatus(value: unknown, source?: JsonRecord): OnboardingStatus {
  const parsed = GuidanceStatusSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (source?.completed === true || source?.seen === true) return "completed";
  if (source?.skipped === true) return "skipped";
  if (source?.started === true) return "started";
  if (value === true || value === 1 || value === "1" || value === "done") return "completed";
  return "not_started";
}

function normalizeTourStatus(value: unknown): TourStatus {
  const parsed = TourStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : "not_started";
}

function normalizeTemplate(value: unknown): OnboardingTemplate | null {
  const parsed = OnboardingTemplateSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (value === "study" || value === "student") return "school";
  if (value === "office") return "work";
  if (value === "reading" || value === "study_project") return "project";
  if (value === "empty") return "blank";
  return null;
}

function normalizeStep(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.min(ONBOARDING_STEP_COUNT, Math.max(1, Math.round(value)));
}

function normalizeDraftItem(value: unknown, index: number): OnboardingDraftItem | null {
  if (!isRecord(value) || typeof value.title !== "string" || !value.title.trim()) return null;
  const candidate = {
    id: typeof value.id === "string" && value.id.trim() ? value.id : `draft-${index + 1}`,
    title: value.title,
    durationMin: value.durationMin,
    fixedTime: value.fixedTime,
    priority: value.priority,
  };
  const parsed = OnboardingDraftItemSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const minimal = OnboardingDraftItemSchema.safeParse({
    id: candidate.id,
    title: candidate.title,
    priority: "normal",
  });
  return minimal.success ? minimal.data : null;
}

function normalizeDraft(value: unknown): OnboardingDraft | null {
  if (!isRecord(value)) return null;
  const items = Array.isArray(value.items)
    ? value.items
      .slice(0, 20)
      .map(normalizeDraftItem)
      .filter((item): item is OnboardingDraftItem => item !== null)
    : [];
  const parsed = OnboardingDraftSchema.safeParse({
    date: value.date ?? value.selectedDate,
    dayStart: value.dayStart,
    dayEnd: value.dayEnd,
    energy: value.energy ?? value.energyLevel,
    items,
  });
  return parsed.success ? parsed.data : null;
}

function migrateV4(value: JsonRecord, now: Date): OnboardingState | null {
  if (value.schemaVersion !== ONBOARDING_SCHEMA_VERSION) return null;
  const parsed = OnboardingStateSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  const defaults = createDefaultOnboardingState(now);
  const productGuide = isRecord(value.productGuide) ? value.productGuide : {};
  const quickStart = isRecord(value.quickStart) ? value.quickStart : {};
  const tour = isRecord(value.tour) ? value.tour : {};
  const sampleDay = isRecord(value.sampleDay) ? value.sampleDay : {};
  const productVersion = productGuide.version;
  const productStatus = productVersion === PRODUCT_GUIDE_VERSION
    ? normalizeStatus(productGuide.status, productGuide)
    : "not_started";
  const quickStatus = normalizeStatus(quickStart.status, quickStart);
  const quickStage = QuickStartStageSchema.safeParse(quickStart.stage);

  return OnboardingStateSchema.parse({
    ...defaults,
    productGuide: {
      version: PRODUCT_GUIDE_VERSION,
      status: productStatus,
      currentStep: productStatus === "completed"
        ? ONBOARDING_STEP_COUNT
        : productStatus === "not_started" ? 1 : normalizeStep(productGuide.currentStep),
      startedAt: productStatus === "not_started" ? undefined : safeIso(productGuide.startedAt),
      completedAt: productStatus === "completed" ? safeIso(productGuide.completedAt) : undefined,
    },
    quickStart: {
      status: quickStatus,
      stage: quickStatus === "completed"
        ? "completed"
        : quickStage.success ? quickStage.data : "add_task",
      taskId: typeof quickStart.taskId === "string" && quickStart.taskId.trim()
        ? quickStart.taskId
        : undefined,
      startedAt: safeIso(quickStart.startedAt),
      completedAt: quickStatus === "completed" ? safeIso(quickStart.completedAt) : undefined,
    },
    tour: {
      coreStatus: normalizeTourStatus(tour.coreStatus),
      fullStatus: normalizeTourStatus(tour.fullStatus),
    },
    sampleDay: {
      selectedTemplate: normalizeTemplate(sampleDay.selectedTemplate),
      draft: normalizeDraft(sampleDay.draft),
    },
    updatedAt: safeIso(value.updatedAt) ?? safeNow(now),
  });
}

function migrateStructuredLegacy(value: JsonRecord, now: Date): OnboardingState | null {
  if (
    !isRecord(value.productGuide)
    && !isRecord(value.quickStart)
    && !isRecord(value.tour)
    && !isRecord(value.sampleDay)
  ) {
    return null;
  }

  const defaults = createDefaultOnboardingState(now);
  const productGuide = isRecord(value.productGuide) ? value.productGuide : {};
  const quickStart = isRecord(value.quickStart) ? value.quickStart : {};
  const tour = isRecord(value.tour) ? value.tour : {};
  const sampleDay = isRecord(value.sampleDay) ? value.sampleDay : {};
  const productStatus = productGuide.version === PRODUCT_GUIDE_VERSION
    ? normalizeStatus(productGuide.status, productGuide)
    : "not_started";
  const quickStatus = normalizeStatus(quickStart.status, quickStart);
  const quickStage = QuickStartStageSchema.safeParse(quickStart.stage);

  return OnboardingStateSchema.parse({
    ...defaults,
    productGuide: {
      version: PRODUCT_GUIDE_VERSION,
      status: productStatus,
      currentStep: productStatus === "completed"
        ? ONBOARDING_STEP_COUNT
        : productStatus === "not_started" ? 1 : normalizeStep(productGuide.currentStep),
      startedAt: productStatus === "not_started" ? undefined : safeIso(productGuide.startedAt),
      completedAt: productStatus === "completed" ? safeIso(productGuide.completedAt) : undefined,
    },
    quickStart: {
      status: quickStatus,
      stage: quickStatus === "completed"
        ? "completed"
        : quickStage.success ? quickStage.data : "add_task",
      taskId: typeof quickStart.taskId === "string" && quickStart.taskId.trim()
        ? quickStart.taskId
        : undefined,
      startedAt: safeIso(quickStart.startedAt),
      completedAt: quickStatus === "completed" ? safeIso(quickStart.completedAt) : undefined,
    },
    tour: {
      coreStatus: normalizeTourStatus(tour.coreStatus),
      fullStatus: normalizeTourStatus(tour.fullStatus),
    },
    sampleDay: {
      selectedTemplate: normalizeTemplate(sampleDay.selectedTemplate),
      draft: normalizeDraft(sampleDay.draft),
    },
    updatedAt: safeIso(value.updatedAt) ?? safeNow(now),
  });
}

/**
 * Migrates guidance only. It never reads, writes, or copies Flow task state.
 * Unversioned Product Guide progress is stale; independent Quick Start, Tour,
 * and Sample Day progress is preserved when those fields are available.
 */
export function migrateOnboardingState(value: unknown, now = new Date()): OnboardingState {
  const iso = safeNow(now);
  if (isRecord(value)) {
    const current = migrateV4(value, now);
    if (current) return current;
    const structured = migrateStructuredLegacy(value, now);
    if (structured) return structured;
  }

  const source = isRecord(value) ? value : {};
  // Scalar and pre-versioned Product Guide values belong to an older
  // experience. They may inform independent Tour migration, but can never
  // resolve the current versioned Product Guide.
  const status: OnboardingStatus = "not_started";
  const selectedTemplate = normalizeTemplate(
    source.selectedTemplate ?? source.template ?? source.templateType,
  );
  const draft = normalizeDraft(source.draft ?? source.draftSnapshot);
  const currentStep = 1;

  return OnboardingStateSchema.parse({
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    productGuide: {
      version: PRODUCT_GUIDE_VERSION,
      status,
      currentStep,
      startedAt: undefined,
      completedAt: undefined,
    },
    quickStart: {
      status: "not_started",
      stage: "add_task",
    },
    tour: {
      coreStatus: source.seen === true ? "completed" : "not_started",
      fullStatus: "not_started",
    },
    sampleDay: { selectedTemplate, draft },
    updatedAt: safeIso(source.updatedAt) ?? iso,
  });
}

function parseJson(raw: string): { success: true; value: unknown } | { success: false } {
  try {
    return { success: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { success: false };
  }
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: StorageLike, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Guidance never blocks the product when storage is unavailable.
  }
}

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Reset is best-effort when storage is unavailable.
  }
}

const ONBOARDING_STORAGE_PROBE_KEY = "flow_onboarding_storage_probe";

/**
 * The Planner gate must fail open when browser storage cannot persist state.
 * Otherwise completing or skipping the Guide would immediately redirect back
 * to it and trap the user in a loop.
 */
export function canPersistOnboardingState(storage: StorageLike): boolean {
  let previous: string | null = null;
  try {
    previous = storage.getItem(ONBOARDING_STORAGE_PROBE_KEY);
    storage.setItem(ONBOARDING_STORAGE_PROBE_KEY, "1");
    const persisted = storage.getItem(ONBOARDING_STORAGE_PROBE_KEY) === "1";
    if (previous == null) storage.removeItem(ONBOARDING_STORAGE_PROBE_KEY);
    else storage.setItem(ONBOARDING_STORAGE_PROBE_KEY, previous);
    return persisted;
  } catch {
    if (previous == null) safeRemove(storage, ONBOARDING_STORAGE_PROBE_KEY);
    else safeSet(storage, ONBOARDING_STORAGE_PROBE_KEY, previous);
    return false;
  }
}

function persistNormalized(storage: StorageLike, state: OnboardingState): OnboardingState {
  safeSet(storage, ONBOARDING_KEY, JSON.stringify(state));
  return state;
}

export function loadOnboardingState(storage: StorageLike, now = new Date()): OnboardingState {
  const currentRaw = safeGet(storage, ONBOARDING_KEY);
  if (currentRaw != null) {
    const current = parseJson(currentRaw);
    if (current.success) {
      return persistNormalized(storage, migrateOnboardingState(current.value, now));
    }
  }

  const legacyRaw = safeGet(storage, LEGACY_ONBOARDING_KEY);
  if (legacyRaw != null) {
    const legacy = parseJson(legacyRaw);
    if (legacy.success) {
      return persistNormalized(storage, migrateOnboardingState(legacy.value, now));
    }
  }

  const legacyTour = safeGet(storage, LEGACY_TOUR_KEY);
  if (legacyTour && legacyTour !== "0" && legacyTour !== "false") {
    const migrated = createDefaultOnboardingState(now);
    migrated.tour.coreStatus = "completed";
    return persistNormalized(storage, migrated);
  }

  return createDefaultOnboardingState(now);
}

export function saveOnboardingState(
  storage: StorageLike,
  value: unknown,
  now = new Date(),
): OnboardingState {
  const normalized = migrateOnboardingState(value, now);
  const saved = OnboardingStateSchema.parse({
    ...normalized,
    updatedAt: safeNow(now),
  });
  return persistNormalized(storage, saved);
}

export type OnboardingStatePatch = Partial<
  Pick<OnboardingState, "productGuide" | "quickStart" | "tour" | "sampleDay">
>;

export function updateOnboardingState(
  storage: StorageLike,
  patch: OnboardingStatePatch,
  now = new Date(),
): OnboardingState {
  return saveOnboardingState(storage, {
    ...loadOnboardingState(storage, now),
    ...patch,
  }, now);
}

export function startProductGuide(
  storage: StorageLike,
  currentStep = 1,
  now = new Date(),
): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    productGuide: {
      version: PRODUCT_GUIDE_VERSION,
      status: "started",
      currentStep: normalizeStep(currentStep),
      startedAt: existing.productGuide.startedAt ?? safeNow(now),
    },
  }, now);
}

export function setProductGuideStep(
  storage: StorageLike,
  currentStep: number,
  now = new Date(),
): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    productGuide: {
      ...existing.productGuide,
      status: "started",
      currentStep: normalizeStep(currentStep),
      startedAt: existing.productGuide.startedAt ?? safeNow(now),
      completedAt: undefined,
    },
  }, now);
}

export function skipProductGuide(storage: StorageLike, now = new Date()): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    productGuide: {
      ...existing.productGuide,
      status: "skipped",
      completedAt: undefined,
    },
  }, now);
}

export function completeProductGuide(storage: StorageLike, now = new Date()): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    productGuide: {
      ...existing.productGuide,
      status: "completed",
      currentStep: ONBOARDING_STEP_COUNT,
      completedAt: safeNow(now),
    },
  }, now);
}

export function startQuickStart(storage: StorageLike, now = new Date()): OnboardingState {
  return updateOnboardingState(storage, {
    quickStart: {
      status: "started",
      stage: "add_task",
      startedAt: safeNow(now),
    },
  }, now);
}

export function restartQuickStart(storage: StorageLike, now = new Date()): OnboardingState {
  return startQuickStart(storage, now);
}

export function recordQuickStartTask(
  storage: StorageLike,
  taskId: string,
  hasFixedTime: boolean,
  now = new Date(),
): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  if (existing.quickStart.status !== "started") return existing;
  return updateOnboardingState(storage, {
    quickStart: {
      ...existing.quickStart,
      stage: hasFixedTime ? "completed" : "schedule_task",
      taskId,
    },
  }, now);
}

export function completeQuickStart(storage: StorageLike, now = new Date()): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    quickStart: {
      ...existing.quickStart,
      status: "completed",
      stage: "completed",
      completedAt: existing.quickStart.completedAt ?? safeNow(now),
    },
  }, now);
}

export function skipQuickStart(storage: StorageLike, now = new Date()): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    quickStart: {
      ...existing.quickStart,
      status: "skipped",
      completedAt: undefined,
    },
  }, now);
}

export function setTourStatus(
  storage: StorageLike,
  mode: "core" | "full",
  status: TourStatus,
  now = new Date(),
): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return updateOnboardingState(storage, {
    tour: {
      ...existing.tour,
      [mode === "core" ? "coreStatus" : "fullStatus"]: status,
    },
  }, now);
}

export function updateSampleDay(
  storage: StorageLike,
  sampleDay: OnboardingState["sampleDay"],
  now = new Date(),
): OnboardingState {
  return updateOnboardingState(storage, { sampleDay }, now);
}

export function markExistingUserGuidance(
  storage: StorageLike,
  _hasTasks: boolean,
  now = new Date(),
): OnboardingState {
  return loadOnboardingState(storage, now);
}

export function resetOnboardingState(storage: StorageLike): OnboardingState {
  safeRemove(storage, ONBOARDING_KEY);
  safeRemove(storage, LEGACY_ONBOARDING_KEY);
  safeRemove(storage, LEGACY_TOUR_KEY);
  return createDefaultOnboardingState();
}

export function hasResolvedOnboarding(state: OnboardingState): boolean {
  return state.productGuide.version === PRODUCT_GUIDE_VERSION
    && (state.productGuide.status === "completed" || state.productGuide.status === "skipped");
}

export function onboardingEntryPath(state: OnboardingState): "/guide" | "/app" {
  return hasResolvedOnboarding(state) ? "/app" : "/guide";
}

// Compatibility aliases for older internal call sites. They affect only the
// Product Guide and deliberately do not start or complete Quick Start.
export const startOnboarding = startProductGuide;
export const skipOnboarding = skipProductGuide;
export const completeOnboarding = completeProductGuide;
