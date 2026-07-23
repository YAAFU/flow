import { describe, expect, it } from "vitest";
import {
  LEGACY_ONBOARDING_KEY,
  LEGACY_TOUR_KEY,
  ONBOARDING_KEY,
  completeProductGuide,
  completeQuickStart,
  createDefaultOnboardingState,
  hasResolvedOnboarding,
  loadOnboardingState,
  markExistingUserGuidance,
  migrateOnboardingState,
  onboardingEntryPath,
  recordQuickStartTask,
  resetOnboardingState,
  saveOnboardingState,
  setProductGuideStep,
  skipProductGuide,
  skipQuickStart,
  startProductGuide,
  startQuickStart,
  updateSampleDay,
} from "@/lib/onboarding";
import { STATE_KEY, type StorageLike } from "@/lib/storage";

const NOW = new Date("2026-07-23T08:00:00.000Z");

class MemoryStorage implements StorageLike {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("onboarding state v3", () => {
  it("creates independent Product Guide, Quick Start, Tour and Sample Day states", () => {
    expect(createDefaultOnboardingState(NOW)).toEqual({
      schemaVersion: 3,
      productGuide: { status: "not_started", currentStep: 1 },
      quickStart: { status: "not_started", stage: "add_task" },
      tour: { coreStatus: "not_started", fullStatus: "not_started" },
      sampleDay: { selectedTemplate: null, draft: null },
      updatedAt: NOW.toISOString(),
    });
  });

  it("migrates a started v2 guide and preserves its optional sample draft", () => {
    const migrated = migrateOnboardingState({
      schemaVersion: 2,
      status: "started",
      currentStep: 4,
      selectedTemplate: "school",
      draft: {
        date: "2026-07-24",
        dayStart: "08:00",
        dayEnd: "20:00",
        energy: "high",
        items: [{ id: "one", title: "อ่านหนังสือ", durationMin: 60, priority: "normal" }],
      },
      startedAt: NOW.toISOString(),
    }, NOW);

    expect(migrated).toMatchObject({
      schemaVersion: 3,
      productGuide: { status: "started", currentStep: 3 },
      quickStart: { status: "not_started", stage: "add_task" },
      sampleDay: {
        selectedTemplate: "school",
        draft: { date: "2026-07-24", energy: "high" },
      },
    });
  });

  it.each(["completed", "skipped"] as const)(
    "does not force an existing v2 %s user into Quick Start",
    (status) => {
      const migrated = migrateOnboardingState({ schemaVersion: 2, status }, NOW);
      expect(migrated.productGuide.status).toBe(status);
      expect(migrated.quickStart.status).toBe("skipped");
      expect(onboardingEntryPath(migrated)).toBe("/app");
    },
  );

  it("migrates the old tour flag without scheduling any automatic tour", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TOUR_KEY, "1");
    const state = loadOnboardingState(storage, NOW);
    expect(state.productGuide.status).toBe("completed");
    expect(state.quickStart.status).toBe("skipped");
    expect(state.tour.coreStatus).toBe("completed");
  });

  it("is idempotent when a v3 value is loaded repeatedly", () => {
    const storage = new MemoryStorage();
    const first = saveOnboardingState(storage, {
      ...createDefaultOnboardingState(NOW),
      productGuide: { status: "started", currentStep: 2, startedAt: NOW.toISOString() },
    }, NOW);
    expect(loadOnboardingState(storage, NOW)).toEqual(first);
    expect(loadOnboardingState(storage, NOW)).toEqual(first);
  });

  it("tracks Product Guide and Quick Start independently", () => {
    const storage = new MemoryStorage();
    startProductGuide(storage, 1, NOW);
    setProductGuideStep(storage, 2, NOW);
    completeProductGuide(storage, NOW);
    let state = startQuickStart(storage, NOW);
    expect(state.productGuide.status).toBe("completed");
    expect(state.quickStart).toMatchObject({ status: "started", stage: "add_task" });

    state = recordQuickStartTask(storage, "task-1", false, NOW);
    expect(state.quickStart).toMatchObject({ stage: "schedule_task", taskId: "task-1" });
    state = recordQuickStartTask(storage, "task-1", true, NOW);
    expect(state.quickStart.stage).toBe("completed");
    expect(state.quickStart.status).toBe("started");
    state = completeQuickStart(storage, NOW);
    expect(state.quickStart).toMatchObject({
      status: "completed",
      stage: "completed",
      completedAt: NOW.toISOString(),
    });
    state = startProductGuide(storage, 1, NOW);
    expect(state.quickStart.status).toBe("completed");
  });

  it("keeps add_task when a form closes without recordQuickStartTask", () => {
    const storage = new MemoryStorage();
    const started = startQuickStart(storage, NOW);
    expect(loadOnboardingState(storage, NOW).quickStart).toEqual(started.quickStart);
  });

  it("can skip each first-time experience without changing the other", () => {
    const storage = new MemoryStorage();
    startProductGuide(storage, 2, NOW);
    startQuickStart(storage, NOW);
    skipProductGuide(storage, NOW);
    const state = skipQuickStart(storage, NOW);
    expect(state.productGuide.status).toBe("skipped");
    expect(state.quickStart.status).toBe("skipped");
  });

  it("marks only uninitialized users with existing tasks as existing users", () => {
    const storage = new MemoryStorage();
    const existing = markExistingUserGuidance(storage, true, NOW);
    expect(existing.productGuide.status).toBe("skipped");
    expect(existing.quickStart.status).toBe("skipped");

    const newStorage = new MemoryStorage();
    expect(markExistingUserGuidance(newStorage, false, NOW).productGuide.status).toBe("not_started");
  });

  it("keeps Sample Day progress out of Product Guide progress", () => {
    const storage = new MemoryStorage();
    const state = updateSampleDay(storage, {
      selectedTemplate: "work",
      draft: {
        date: "2026-07-24",
        dayStart: "08:00",
        dayEnd: "20:00",
        energy: "medium",
        items: [{ id: "sample", title: "ประชุม", durationMin: 30, priority: "normal" }],
      },
    }, NOW);
    expect(state.productGuide).toEqual({ status: "not_started", currentStep: 1 });
    expect(state.sampleDay.selectedTemplate).toBe("work");
  });

  it("reset removes guidance keys only and never task/settings state", () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, "task-state-sentinel");
    storage.setItem("unrelated_settings", "keep");
    storage.setItem(ONBOARDING_KEY, JSON.stringify(createDefaultOnboardingState(NOW)));
    storage.setItem(LEGACY_ONBOARDING_KEY, "{}");
    storage.setItem(LEGACY_TOUR_KEY, "1");

    resetOnboardingState(storage);
    expect(storage.getItem(ONBOARDING_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_ONBOARDING_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_TOUR_KEY)).toBeNull();
    expect(storage.getItem(STATE_KEY)).toBe("task-state-sentinel");
    expect(storage.getItem("unrelated_settings")).toBe("keep");
  });

  it("fails open when browser storage is unavailable", () => {
    const unavailable: StorageLike = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };
    expect(() => loadOnboardingState(unavailable, NOW)).not.toThrow();
    expect(() => startQuickStart(unavailable, NOW)).not.toThrow();
    expect(() => resetOnboardingState(unavailable)).not.toThrow();
  });
});

describe("onboarding entry routing", () => {
  it.each([
    ["not_started", "/guide"],
    ["started", "/guide"],
    ["skipped", "/app"],
    ["completed", "/app"],
  ] as const)("routes Product Guide %s to %s", (status, path) => {
    const state = createDefaultOnboardingState(NOW);
    state.productGuide.status = status;
    expect(onboardingEntryPath(state)).toBe(path);
    expect(hasResolvedOnboarding(state)).toBe(path === "/app");
  });
});
