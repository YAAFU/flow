import { TaskLocationSchema, type TaskLocation } from "@/lib/location";
import {
  RecentPlaceSchema,
  SavedPlaceSchema,
  type RecentPlace,
  type SavedPlace,
  type SavedPlaceCategory,
} from "@/lib/types";

export const MAX_RECENT_PLACES = 5;

export type PlaceSuggestion = {
  key: string;
  location: TaskLocation;
  reason: string;
  score: number;
  savedPlaceId?: string;
};

export type PlaceContext = {
  date?: string;
  hour?: number;
  categoryId?: string;
};

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("th-TH").replace(/\s+/gu, " ");
}

function coordinatePart(value: number | undefined): string {
  return value == null ? "" : value.toFixed(5);
}

export function placeKey(place: Pick<TaskLocation, "name" | "latitude" | "longitude">): string {
  return [
    normalizedName(place.name),
    coordinatePart(place.latitude),
    coordinatePart(place.longitude),
  ].join("|");
}

function bangkokParts(value: Date): { dayOfWeek: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  return { dayOfWeek: Math.max(0, dayOfWeek), hour: Number.isFinite(hour) ? hour : 0 };
}

export function bangkokPlaceHour(value = new Date()): number {
  return bangkokParts(value).hour;
}

export function savedPlaceToLocation(place: SavedPlace, source: "saved" | "suggested" = "saved"): TaskLocation {
  return TaskLocationSchema.parse({
    name: place.label,
    latitude: place.latitude,
    longitude: place.longitude,
    source,
  });
}

export function recentPlaceToLocation(place: RecentPlace, source: "recent" | "suggested" = "recent"): TaskLocation {
  return TaskLocationSchema.parse({
    name: place.placeName,
    latitude: place.latitude,
    longitude: place.longitude,
    source,
  });
}

export function buildSavedPlace(input: {
  id?: string;
  label: string;
  placeName?: string;
  latitude?: number;
  longitude?: number;
  category?: SavedPlaceCategory;
  icon?: string;
  existing?: SavedPlace;
  now?: Date;
}): SavedPlace {
  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  return SavedPlaceSchema.parse({
    ...input.existing,
    id: input.existing?.id ?? input.id ?? crypto.randomUUID(),
    label: input.label.trim(),
    placeName: input.placeName?.trim() || input.label.trim(),
    latitude: input.latitude,
    longitude: input.longitude,
    category: input.category ?? input.existing?.category ?? "custom",
    icon: input.icon ?? input.existing?.icon,
    createdAt: input.existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  });
}

export function recordRecentPlace(
  current: readonly RecentPlace[],
  location: TaskLocation | null | undefined,
  options: { usedAt?: Date; categoryId?: string; limit?: number } = {},
): RecentPlace[] {
  if (!location) return [...current];
  const usedAt = options.usedAt ?? new Date();
  const key = placeKey(location);
  const existing = current.find((place) => place.placeKey === key || normalizedName(place.placeName) === normalizedName(location.name));
  const context = bangkokParts(usedAt);
  const next = RecentPlaceSchema.parse({
    placeKey: key,
    placeName: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    lastUsedAt: usedAt.toISOString(),
    useCount: (existing?.useCount ?? 0) + 1,
    lastUsedDayOfWeek: context.dayOfWeek,
    lastUsedHour: context.hour,
    categoryId: options.categoryId ?? existing?.categoryId,
  });
  return [
    next,
    ...current.filter((place) => place.placeKey !== key && normalizedName(place.placeName) !== normalizedName(location.name)),
  ].sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt))
    .slice(0, options.limit ?? MAX_RECENT_PLACES);
}

function dateWeekday(date: string | undefined): number | undefined {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/u.test(date)) return undefined;
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function suggestionReason(recent: RecentPlace | undefined, context: PlaceContext): string {
  if (!recent) return "สถานที่ประจำของคุณ";
  const weekday = dateWeekday(context.date);
  if (context.categoryId && recent.categoryId === context.categoryId) return "มักใช้กับงานประเภทนี้";
  if (weekday != null && recent.lastUsedDayOfWeek === weekday && weekday > 0 && weekday < 6) return "ไปบ่อยในวันธรรมดา";
  if (context.hour != null && recent.lastUsedHour != null && Math.abs(context.hour - recent.lastUsedHour) <= 2) {
    if (context.hour < 12) return "มักใช้ช่วงเช้า";
    if (context.hour >= 17) return "ใช้บ่อยในช่วงเย็น";
    return "มักใช้ช่วงเวลานี้";
  }
  return recent.useCount > 1 ? `ใช้บ่อย ${recent.useCount} ครั้ง` : "ใช้ล่าสุดไม่นานนี้";
}

export function rankPlaceSuggestions(
  savedPlaces: readonly SavedPlace[],
  recentPlaces: readonly RecentPlace[],
  context: PlaceContext = {},
  enabled = true,
): PlaceSuggestion[] {
  if (!enabled) return [];
  const weekday = dateWeekday(context.date);
  const candidates = new Map<string, PlaceSuggestion>();

  for (const saved of savedPlaces) {
    const location = savedPlaceToLocation(saved, "suggested");
    const matchingRecent = recentPlaces.find((recent) =>
      normalizedName(recent.placeName) === normalizedName(saved.label)
      || normalizedName(recent.placeName) === normalizedName(saved.placeName));
    let score = 100 + Math.min(25, (matchingRecent?.useCount ?? 0) * 4);
    if (context.categoryId && matchingRecent?.categoryId === context.categoryId) score += 24;
    if (weekday != null && matchingRecent?.lastUsedDayOfWeek === weekday) score += 16;
    if (context.hour != null && matchingRecent?.lastUsedHour != null && Math.abs(context.hour - matchingRecent.lastUsedHour) <= 2) score += 12;
    candidates.set(placeKey(location), {
      key: placeKey(location),
      location,
      reason: suggestionReason(matchingRecent, context),
      score,
      savedPlaceId: saved.id,
    });
  }

  for (const recent of recentPlaces) {
    const location = recentPlaceToLocation(recent, "suggested");
    const key = placeKey(location);
    if (candidates.has(key)) continue;
    let score = 45 + Math.min(30, recent.useCount * 5);
    if (context.categoryId && recent.categoryId === context.categoryId) score += 24;
    if (weekday != null && recent.lastUsedDayOfWeek === weekday) score += 16;
    if (context.hour != null && recent.lastUsedHour != null && Math.abs(context.hour - recent.lastUsedHour) <= 2) score += 12;
    candidates.set(key, { key, location, reason: suggestionReason(recent, context), score });
  }

  return [...candidates.values()].sort((left, right) => right.score - left.score).slice(0, 5);
}

export function findSavedPlaceMention(
  text: string,
  savedPlaces: readonly SavedPlace[],
): SavedPlace | undefined {
  const normalized = normalizedName(text);
  return [...savedPlaces]
    .sort((left, right) => Math.max(right.label.length, right.placeName.length) - Math.max(left.label.length, left.placeName.length))
    .find((place) => normalized.includes(normalizedName(place.label)) || normalized.includes(normalizedName(place.placeName)));
}
