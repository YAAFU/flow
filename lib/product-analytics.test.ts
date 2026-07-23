import { afterEach, describe, expect, it, vi } from "vitest";
import {
  configureProductAnalytics,
  createDevelopmentAnalyticsLogger,
  sanitizeProductEventMetadata,
  trackProductEvent,
  type ProductAnalyticsEvent,
} from "@/lib/product-analytics";

afterEach(() => {
  configureProductAnalytics(null);
  vi.restoreAllMocks();
});

describe("product analytics privacy boundary", () => {
  it("allows only event-specific, non-identifying metadata", () => {
    expect(sanitizeProductEventMetadata("first_plan_generated", {
      plannerMode: "local",
      completionStatus: "success",
      durationBucket: "30_60s",
      step: 4,
      entryPoint: "guide",
      title: "ข้อความส่วนตัว",
      place: "บ้าน",
      latitude: 13.7,
      longitude: 100.5,
      email: "person@example.com",
      text: "free form",
    })).toEqual({
      plannerMode: "local",
      completionStatus: "success",
      durationBucket: "30_60s",
    });
  });

  it("drops arbitrary strings even when they use an allowed key", () => {
    expect(sanitizeProductEventMetadata("guide_viewed", {
      entryPoint: "email-or-user-entered-text",
    })).toEqual({});
    expect(sanitizeProductEventMetadata("persona_example_selected", {
      templateType: "my custom private template",
    })).toEqual({});
    expect(sanitizeProductEventMetadata("guide_step_completed", {
      step: 2.5,
    })).toEqual({});
  });

  it("never includes task or location data in Quick Start events", () => {
    expect(sanitizeProductEventMetadata("quick_start_task_created", {
      title: "ประชุมลับ",
      place: "บ้าน",
      latitude: 13.7,
      longitude: 100.5,
      taskId: "private-id",
    })).toEqual({});
    expect(sanitizeProductEventMetadata("quick_start_plan_applied", {
      plannerMode: "local",
      taskId: "private-id",
    })).toEqual({ plannerMode: "local" });
  });

  it("sends a frozen, sanitized event to an injected provider", () => {
    const events: ProductAnalyticsEvent[] = [];
    configureProductAnalytics({
      track(event) {
        events.push(event);
      },
    });

    trackProductEvent("persona_example_selected", {
      templateType: "project",
      title: "must be removed",
    });

    expect(events).toEqual([{
      name: "persona_example_selected",
      metadata: { templateType: "project" },
    }]);
    expect(Object.isFrozen(events[0])).toBe(true);
    expect(Object.isFrozen(events[0].metadata)).toBe(true);
  });

  it("does not let synchronous or asynchronous provider failure break UX", async () => {
    configureProductAnalytics({
      track() {
        throw new Error("provider unavailable");
      },
    });
    expect(() => trackProductEvent("guide_started", { entryPoint: "guide" })).not.toThrow();

    configureProductAnalytics({
      track() {
        return Promise.reject(new Error("provider unavailable"));
      },
    });
    expect(() => trackProductEvent("guide_completed", {
      completionStatus: "success",
    })).not.toThrow();
    await Promise.resolve();
  });

  it("provides an opt-in development logger that receives sanitized events", () => {
    const logger = vi.fn();
    configureProductAnalytics(createDevelopmentAnalyticsLogger(logger));

    trackProductEvent("guide_skipped", {
      step: 2,
      entryPoint: "guide",
      email: "must-not-leak@example.com",
    });

    expect(logger).toHaveBeenCalledWith("[flow analytics]", {
      name: "guide_skipped",
      metadata: { step: 2, entryPoint: "guide" },
    });
  });
});
