import { z } from "zod";
import type { StorageLike } from "@/lib/storage";
import {
  DayEnergySchema,
  IsoDateSchema,
  PrioritySchema,
  TimeSchema,
} from "@/lib/types";

export const ONBOARDING_KEY = "flow_onboarding_v2";
export const LEGACY_ONBOARDING_KEY = "flow_onboarding_v1";
export const LEGACY_TOUR_KEY = "flow_tour_seen";
export const ONBOARDING_SCHEMA_VERSION = 2 as const;
export const ONBOARDING_STEP_COUNT = 4 as const;

export const OnboardingStatusSchema = z.enum([
  "not_started",
  "started",
  "skipped",
  "completed",
]);

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

export const OnboardingStateSchema = z.object({
  schemaVersion: z.literal(ONBOARDING_SCHEMA_VERSION),
  status: OnboardingStatusSchema,
  currentStep: z.number().int().min(1).max(ONBOARDING_STEP_COUNT),
  selectedTemplate: OnboardingTemplateSchema.nullable(),
  draft: OnboardingDraftSchema.nullable(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});

export type OnboardingStatus = z.infer<typeof OnboardingStatusSchema>;
export type OnboardingTemplate = z.infer<typeof OnboardingTemplateSchema>;
export type SelectedOnboardingTemplate = OnboardingTemplate;
export type OnboardingDraftItem = z.infer<typeof OnboardingDraftItemSchema>;
export type OnboardingDraft = z.infer<typeof OnboardingDraftSchema>;
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
    status: "not_started",
    currentStep: 1,
    selectedTemplate: null,
    draft: null,
    updatedAt: safeNow(now),
  };
}

function normalizeStatus(value: unknown, source?: JsonRecord): OnboardingStatus {
  const parsed = OnboardingStatusSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  if (source?.completed === true || source?.seen === true) return "completed";
  if (source?.skipped === true) return "skipped";
  if (source?.started === true) return "started";
  if (value === true || value === 1 || value === "1" || value === "done") return "completed";
  return "not_started";
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

  // A malformed optional detail must not discard an otherwise usable draft.
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

/**
 * Migrates persisted onboarding data without ever reading or mutating Flow's
 * task state. Unknown fields are deliberately stripped by the schemas.
 */
export function migrateOnboardingState(value: unknown, now = new Date()): OnboardingState {
  const iso = safeNow(now);

  if (
    value === true
    || value === 1
    || value === "1"
    || value === "completed"
    || value === "done"
  ) {
    return {
      ...createDefaultOnboardingState(now),
      status: "completed",
      currentStep: ONBOARDING_STEP_COUNT,
      completedAt: iso,
    };
  }

  if (value === "skipped") {
    return {
      ...createDefaultOnboardingState(now),
      status: "skipped",
      currentStep: 1,
    };
  }

  if (value === "started") {
    return {
      ...createDefaultOnboardingState(now),
      status: "started",
      startedAt: iso,
    };
  }

  if (!isRecord(value)) return createDefaultOnboardingState(now);

  const status = normalizeStatus(value.status, value);
  const currentStep = normalizeStep(value.currentStep ?? value.step);
  const selectedTemplate = normalizeTemplate(
    value.selectedTemplate ?? value.template ?? value.templateType,
  );
  const draft = normalizeDraft(value.draft ?? value.draftSnapshot);

  return OnboardingStateSchema.parse({
    schemaVersion: ONBOARDING_SCHEMA_VERSION,
    status,
    currentStep: status === "completed" ? ONBOARDING_STEP_COUNT : currentStep,
    selectedTemplate,
    draft,
    startedAt: safeIso(value.startedAt)
      ?? (status === "started" || status === "completed" ? iso : undefined),
    completedAt: safeIso(value.completedAt) ?? (status === "completed" ? iso : undefined),
    updatedAt: safeIso(value.updatedAt) ?? iso,
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
    // Private browsing or a full storage quota must not block the planner.
  }
}

function safeRemove(storage: StorageLike, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Reset is best-effort when storage is unavailable.
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

  // The old tour flag represented a returning user. Preserve that intent
  // without mixing it into the new resumable guide schema.
  const legacyTour = safeGet(storage, LEGACY_TOUR_KEY);
  if (legacyTour && legacyTour !== "0" && legacyTour !== "false") {
    return persistNormalized(storage, migrateOnboardingState("completed", now));
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
  Pick<
    OnboardingState,
    "status" | "currentStep" | "selectedTemplate" | "draft" | "startedAt" | "completedAt"
  >
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

export function startOnboarding(
  storage: StorageLike,
  currentStep = 1,
  now = new Date(),
): OnboardingState {
  const existing = loadOnboardingState(storage, now);
  return saveOnboardingState(storage, {
    ...existing,
    status: "started",
    currentStep,
    startedAt: existing.startedAt ?? safeNow(now),
    completedAt: undefined,
  }, now);
}

export function skipOnboarding(storage: StorageLike, now = new Date()): OnboardingState {
  return updateOnboardingState(storage, {
    status: "skipped",
    selectedTemplate: null,
    draft: null,
    completedAt: undefined,
  }, now);
}

export function completeOnboarding(storage: StorageLike, now = new Date()): OnboardingState {
  return updateOnboardingState(storage, {
    status: "completed",
    currentStep: ONBOARDING_STEP_COUNT,
    selectedTemplate: null,
    draft: null,
    completedAt: safeNow(now),
  }, now);
}

export function resetOnboardingState(storage: StorageLike): OnboardingState {
  safeRemove(storage, ONBOARDING_KEY);
  safeRemove(storage, LEGACY_ONBOARDING_KEY);
  safeRemove(storage, LEGACY_TOUR_KEY);
  return createDefaultOnboardingState();
}

export function hasResolvedOnboarding(state: OnboardingState): boolean {
  return state.status === "completed" || state.status === "skipped";
}

export function onboardingEntryPath(
  state: Pick<OnboardingState, "status">,
): "/guide" | "/app" {
  return state.status === "completed" || state.status === "skipped"
    ? "/app"
    : "/guide";
}
