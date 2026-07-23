import { describe, expect, it } from "vitest";
import {
  LEGACY_ONBOARDING_KEY,
  LEGACY_TOUR_KEY,
  ONBOARDING_KEY,
  completeOnboarding,
  createDefaultOnboardingState,
  hasResolvedOnboarding,
  loadOnboardingState,
  migrateOnboardingState,
  onboardingEntryPath,
  resetOnboardingState,
  saveOnboardingState,
  skipOnboarding,
  startOnboarding,
  updateOnboardingState,
  type OnboardingDraft,
} from "@/lib/onboarding";
import { STATE_KEY, type StorageLike } from "@/lib/storage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const NOW = new Date("2026-07-23T08:00:00.000Z");

const DRAFT: OnboardingDraft = {
  date: "2026-07-24",
  dayStart: "08:00",
  dayEnd: "20:00",
  energy: "medium",
  items: [
    {
      id: "draft-1",
      title: "ทำงานตัวอย่าง",
      durationMin: 60,
      priority: "normal",
    },
  ],
};

describe("onboarding persistence", () => {
  it("starts from a versioned, resumable default without touching task state", () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, "task-state-sentinel");

    expect(loadOnboardingState(storage, NOW)).toEqual(createDefaultOnboardingState(NOW));
    expect(storage.getItem(STATE_KEY)).toBe("task-state-sentinel");
    expect(storage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("round-trips progress, selected template, and a draft snapshot", () => {
    const storage = new MemoryStorage();
    startOnboarding(storage, 2, NOW);
    const saved = updateOnboardingState(storage, {
      currentStep: 3,
      selectedTemplate: "school",
      draft: DRAFT,
    }, new Date("2026-07-23T08:01:00.000Z"));

    expect(saved).toMatchObject({
      schemaVersion: 2,
      status: "started",
      currentStep: 3,
      selectedTemplate: "school",
      draft: DRAFT,
      startedAt: NOW.toISOString(),
    });
    expect(loadOnboardingState(storage)).toEqual(saved);
  });

  it("strips unrelated task/location fields from a legacy draft while salvaging valid items", () => {
    const migrated = migrateOnboardingState({
      status: "started",
      step: 3,
      template: "study",
      tasksByDay: { private: true },
      draftSnapshot: {
        selectedDate: "2026-07-24",
        energyLevel: "high",
        place: "must not persist",
        items: [
          {
            title: "รายการที่ใช้ได้",
            durationMin: 60,
            place: "must not persist",
            lat: 13.7,
            lng: 100.5,
          },
          { broken: true },
          { title: "รายละเอียดเสียแต่ชื่องานยังใช้ได้", durationMin: -1 },
        ],
      },
    }, NOW);

    expect(migrated).toMatchObject({
      status: "started",
      currentStep: 3,
      selectedTemplate: "school",
      draft: {
        date: "2026-07-24",
        dayStart: "08:00",
        dayEnd: "20:00",
        energy: "high",
      },
    });
    expect(migrated.draft?.items).toEqual([
      {
        id: "draft-1",
        title: "รายการที่ใช้ได้",
        durationMin: 60,
        priority: "normal",
      },
      {
        id: "draft-3",
        title: "รายละเอียดเสียแต่ชื่องานยังใช้ได้",
        priority: "normal",
      },
    ]);
    expect(migrated).not.toHaveProperty("tasksByDay");
    expect(migrated.draft).not.toHaveProperty("place");
    expect(migrated.draft?.items[0]).not.toHaveProperty("lat");
  });

  it("parses corrupt current data safely and falls back to valid legacy progress", () => {
    const storage = new MemoryStorage();
    storage.setItem(ONBOARDING_KEY, "{broken");
    storage.setItem(LEGACY_ONBOARDING_KEY, JSON.stringify({
      status: "started",
      currentStep: 2,
      selectedTemplate: "work",
    }));

    const state = loadOnboardingState(storage, NOW);
    expect(state).toMatchObject({
      schemaVersion: 2,
      status: "started",
      currentStep: 2,
      selectedTemplate: "work",
    });
    expect(JSON.parse(storage.getItem(ONBOARDING_KEY)!)).toEqual(state);
  });

  it("migrates the old tour flag as resolved for a returning user", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_TOUR_KEY, "1");

    const state = loadOnboardingState(storage, NOW);
    expect(state.status).toBe("completed");
    expect(state.currentStep).toBe(4);
    expect(onboardingEntryPath(state)).toBe("/app");
  });

  it("normalizes old and partially malformed versioned values without crashing", () => {
    const state = migrateOnboardingState({
      schemaVersion: 1,
      completed: true,
      currentStep: 99,
      selectedTemplate: "unsupported",
      updatedAt: "not-a-date",
    }, NOW);

    expect(state).toMatchObject({
      schemaVersion: 2,
      status: "completed",
      currentStep: 4,
      selectedTemplate: null,
      updatedAt: NOW.toISOString(),
    });
  });

  it("represents started, skipped, and completed as distinct states", () => {
    const storage = new MemoryStorage();
    expect(startOnboarding(storage, 2, NOW)).toMatchObject({
      status: "started",
      currentStep: 2,
    });
    expect(skipOnboarding(storage, NOW)).toMatchObject({
      status: "skipped",
      currentStep: 2,
    });

    startOnboarding(storage, 1, NOW);
    expect(completeOnboarding(storage, NOW)).toMatchObject({
      status: "completed",
      currentStep: 4,
      completedAt: NOW.toISOString(),
    });
  });

  it("reset removes only onboarding keys and never tasks or settings", () => {
    const storage = new MemoryStorage();
    storage.setItem(STATE_KEY, "task-state-sentinel");
    storage.setItem("unrelated_settings", "keep");
    storage.setItem(ONBOARDING_KEY, JSON.stringify({ status: "started" }));
    storage.setItem(LEGACY_ONBOARDING_KEY, "{}");
    storage.setItem(LEGACY_TOUR_KEY, "1");

    const reset = resetOnboardingState(storage);
    expect(reset.status).toBe("not_started");
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
    expect(saveOnboardingState(unavailable, { status: "started" }, NOW).status).toBe("started");
    expect(() => resetOnboardingState(unavailable)).not.toThrow();
  });
});

describe("onboarding entry routing", () => {
  it.each([
    ["not_started", "/guide"],
    ["started", "/guide"],
    ["skipped", "/app"],
    ["completed", "/app"],
  ] as const)("routes %s to %s without a redirect loop", (status, path) => {
    const state = { ...createDefaultOnboardingState(NOW), status };
    expect(onboardingEntryPath(state)).toBe(path);
    expect(hasResolvedOnboarding(state)).toBe(path === "/app");
  });

  it.each([
    ["not_started", "/guide"],
    ["started", "/guide"],
    ["skipped", "/app"],
    ["completed", "/app"],
  ] as const)("resolves persisted %s state to %s for login and guest entry", (status, path) => {
    const storage = new MemoryStorage();
    saveOnboardingState(storage, {
      ...createDefaultOnboardingState(NOW),
      status,
      currentStep: status === "completed" ? 4 : 2,
    }, NOW);

    const destination = onboardingEntryPath(loadOnboardingState(storage, NOW));
    expect(destination).toBe(path);
    expect(destination).not.toBe("/login");
  });

  it("routes unavailable or corrupt storage to the first-time guide without throwing", () => {
    const storage = new MemoryStorage();
    storage.setItem(ONBOARDING_KEY, "{broken");

    expect(onboardingEntryPath(loadOnboardingState(storage, NOW))).toBe("/guide");
  });
});
