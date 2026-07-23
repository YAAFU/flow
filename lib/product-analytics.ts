export const PRODUCT_EVENT_NAMES = [
  "guide_viewed",
  "guide_started",
  "guide_step_completed",
  "guide_skipped",
  "guide_completed",
  "persona_example_selected",
  "first_task_created",
  "first_plan_generated",
  "first_timeline_viewed",
  "first_focus_started",
  "tour_reopened",
  "product_guide_started",
  "product_guide_step_completed",
  "product_guide_completed",
  "product_guide_skipped",
  "quick_start_started",
  "quick_start_task_created",
  "quick_start_planner_opened",
  "quick_start_plan_applied",
  "quick_start_completed",
  "quick_start_skipped",
  "bulk_text_parser_opened",
  "bulk_text_parse_started",
  "bulk_text_parse_succeeded",
  "bulk_text_parse_failed",
  "bulk_text_preview_edited",
  "bulk_text_tasks_confirmed",
  "bulk_text_tasks_created",
  "bulk_text_planner_used",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export const ANALYTICS_ENTRY_POINTS = [
  "login",
  "guest",
  "app",
  "guide",
  "today",
  "settings",
  "empty_state",
  "unknown",
] as const;

export const ANALYTICS_TEMPLATE_TYPES = [
  "school",
  "work",
  "project",
  "blank",
] as const;

export const ANALYTICS_PLANNER_MODES = ["ai", "local"] as const;
export const ANALYTICS_COMPLETION_STATUSES = [
  "success",
  "skipped",
  "cancelled",
  "failed",
] as const;
export const ANALYTICS_DURATION_BUCKETS = [
  "under_30s",
  "30_60s",
  "60_90s",
  "over_90s",
  "unknown",
] as const;

export type ProductEventMetadata = {
  step?: number;
  entryPoint?: (typeof ANALYTICS_ENTRY_POINTS)[number];
  templateType?: (typeof ANALYTICS_TEMPLATE_TYPES)[number];
  plannerMode?: (typeof ANALYTICS_PLANNER_MODES)[number];
  completionStatus?: (typeof ANALYTICS_COMPLETION_STATUSES)[number];
  durationBucket?: (typeof ANALYTICS_DURATION_BUCKETS)[number];
  itemCount?: number;
  parserMode?: (typeof ANALYTICS_PLANNER_MODES)[number];
  hasAmbiguousItems?: boolean;
  hasLocation?: boolean;
  hasFixedTimes?: boolean;
  requiredPlanner?: boolean;
  success?: boolean;
};

export type SanitizedProductEventMetadata = Readonly<ProductEventMetadata>;

export type ProductAnalyticsEvent = Readonly<{
  name: ProductEventName;
  metadata: SanitizedProductEventMetadata;
}>;

export interface ProductAnalyticsSink {
  track(event: ProductAnalyticsEvent): void | Promise<void>;
}

type MetadataKey = keyof ProductEventMetadata;

const EVENT_METADATA_KEYS: Record<ProductEventName, readonly MetadataKey[]> = {
  guide_viewed: ["entryPoint"],
  guide_started: ["entryPoint"],
  guide_step_completed: ["step"],
  guide_skipped: ["step", "entryPoint"],
  guide_completed: ["completionStatus", "durationBucket"],
  persona_example_selected: ["templateType"],
  first_task_created: ["entryPoint"],
  first_plan_generated: ["plannerMode", "completionStatus", "durationBucket"],
  first_timeline_viewed: ["entryPoint"],
  first_focus_started: ["entryPoint"],
  tour_reopened: ["entryPoint"],
  product_guide_started: ["entryPoint"],
  product_guide_step_completed: ["step"],
  product_guide_completed: ["completionStatus", "durationBucket"],
  product_guide_skipped: ["step", "entryPoint"],
  quick_start_started: ["entryPoint"],
  quick_start_task_created: [],
  quick_start_planner_opened: [],
  quick_start_plan_applied: ["plannerMode"],
  quick_start_completed: ["completionStatus"],
  quick_start_skipped: ["entryPoint"],
  bulk_text_parser_opened: [],
  bulk_text_parse_started: [],
  bulk_text_parse_succeeded: ["itemCount", "parserMode", "hasAmbiguousItems", "hasLocation", "hasFixedTimes", "requiredPlanner", "success"],
  bulk_text_parse_failed: ["success"],
  bulk_text_preview_edited: [],
  bulk_text_tasks_confirmed: ["itemCount", "parserMode", "requiredPlanner", "success"],
  bulk_text_tasks_created: ["itemCount", "parserMode", "requiredPlanner", "success"],
  bulk_text_planner_used: ["itemCount", "parserMode", "success"],
};

const ENTRY_POINTS = new Set<string>(ANALYTICS_ENTRY_POINTS);
const TEMPLATE_TYPES = new Set<string>(ANALYTICS_TEMPLATE_TYPES);
const PLANNER_MODES = new Set<string>(ANALYTICS_PLANNER_MODES);
const COMPLETION_STATUSES = new Set<string>(ANALYTICS_COMPLETION_STATUSES);
const DURATION_BUCKETS = new Set<string>(ANALYTICS_DURATION_BUCKETS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(key: MetadataKey, value: unknown): ProductEventMetadata[MetadataKey] {
  switch (key) {
    case "step":
      return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 20
        ? value
        : undefined;
    case "entryPoint":
      return typeof value === "string" && ENTRY_POINTS.has(value)
        ? value as ProductEventMetadata["entryPoint"]
        : undefined;
    case "templateType":
      return typeof value === "string" && TEMPLATE_TYPES.has(value)
        ? value as ProductEventMetadata["templateType"]
        : undefined;
    case "plannerMode":
      return typeof value === "string" && PLANNER_MODES.has(value)
        ? value as ProductEventMetadata["plannerMode"]
        : undefined;
    case "completionStatus":
      return typeof value === "string" && COMPLETION_STATUSES.has(value)
        ? value as ProductEventMetadata["completionStatus"]
        : undefined;
    case "durationBucket":
      return typeof value === "string" && DURATION_BUCKETS.has(value)
        ? value as ProductEventMetadata["durationBucket"]
        : undefined;
    case "itemCount":
      return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 20 ? value : undefined;
    case "parserMode":
      return typeof value === "string" && PLANNER_MODES.has(value)
        ? value as ProductEventMetadata["parserMode"]
        : undefined;
    case "hasAmbiguousItems":
    case "hasLocation":
    case "hasFixedTimes":
    case "requiredPlanner":
    case "success":
      return typeof value === "boolean" ? value : undefined;
  }
}

/**
 * Runtime privacy boundary. Callers may pass unknown data, but only
 * event-specific, finite categorical metadata can leave the UI layer.
 */
export function sanitizeProductEventMetadata(
  name: ProductEventName,
  metadata: unknown,
): SanitizedProductEventMetadata {
  if (!isRecord(metadata)) return Object.freeze({});
  const safe: ProductEventMetadata = {};
  for (const key of EVENT_METADATA_KEYS[name]) {
    const value = sanitizeValue(key, metadata[key]);
    if (value !== undefined) {
      Object.assign(safe, { [key]: value });
    }
  }
  return Object.freeze(safe);
}

const NOOP_SINK: ProductAnalyticsSink = { track: () => undefined };

export function createDevelopmentAnalyticsLogger(
  logger: (message: string, event: ProductAnalyticsEvent) => void = console.debug,
): ProductAnalyticsSink {
  return {
    track(event) {
      logger("[flow analytics]", event);
    },
  };
}

function createDefaultSink(): ProductAnalyticsSink {
  if (
    process.env.NODE_ENV === "development"
    && process.env.NEXT_PUBLIC_FLOW_ANALYTICS_DEBUG === "1"
  ) {
    return createDevelopmentAnalyticsLogger();
  }
  return NOOP_SINK;
}

let activeSink: ProductAnalyticsSink = createDefaultSink();

/**
 * Installs a future analytics provider. Passing null restores the privacy-safe
 * default (no-op outside explicitly enabled local development logging).
 */
export function configureProductAnalytics(sink: ProductAnalyticsSink | null): void {
  activeSink = sink ?? createDefaultSink();
}

export function trackProductEvent(name: ProductEventName, metadata?: unknown): void {
  const event: ProductAnalyticsEvent = Object.freeze({
    name,
    metadata: sanitizeProductEventMetadata(name, metadata),
  });
  try {
    const result = activeSink.track(event);
    if (result && typeof result.then === "function") {
      void result.catch(() => undefined);
    }
  } catch {
    // Analytics must never interrupt onboarding or the planner.
  }
}

export const trackEvent = trackProductEvent;
