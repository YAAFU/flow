import { z } from "zod";
import { BKK_PLACES } from "@/lib/places";
import { LocationSourceSchema, type LocationSource } from "@/lib/types";

export { LocationSourceSchema };
export type { LocationSource };

export const LatitudeSchema = z.number().finite().min(-90).max(90);
export const LongitudeSchema = z.number().finite().min(-180).max(180);
export const CoordinatesSchema = z.object({
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
});

function requireCoordinatePair(
  value: { latitude?: number; longitude?: number },
  context: z.RefinementCtx,
) {
  if ((value.latitude == null) !== (value.longitude == null)) {
    context.addIssue({
      code: "custom",
      message: "latitude และ longitude ต้องระบุพร้อมกัน",
      path: value.latitude == null ? ["latitude"] : ["longitude"],
    });
  }
}

export const TaskLocationSchema = z.object({
  name: z.string().trim().min(1).max(500),
  latitude: LatitudeSchema.optional(),
  longitude: LongitudeSchema.optional(),
  source: LocationSourceSchema,
  accuracy: z.number().finite().nonnegative().max(100_000).optional(),
  capturedAt: z.string().datetime().optional(),
}).superRefine(requireCoordinatePair);

export type TaskLocation = z.infer<typeof TaskLocationSchema>;

export const CurrentLocationSchema = z.object({
  latitude: LatitudeSchema,
  longitude: LongitudeSchema,
  accuracy: z.number().finite().nonnegative().max(100_000).optional(),
  placeName: z.string().trim().min(1).max(500).optional(),
  capturedAt: z.string().datetime(),
  source: z.enum(["live", "manual"]),
});

export type CurrentLocation = z.infer<typeof CurrentLocationSchema>;

export type FlatTaskLocationFields = {
  place?: unknown;
  lat?: unknown;
  lng?: unknown;
  locationSource?: unknown;
  locationAccuracy?: unknown;
  locationCapturedAt?: unknown;
};

export type FlatTaskLocationPatch = {
  place: string;
  lat?: number;
  lng?: number;
  locationSource?: LocationSource;
  locationAccuracy?: number;
  locationCapturedAt?: string;
};

export function hasCoordinates(
  location: Pick<TaskLocation, "latitude" | "longitude"> | null | undefined,
): location is TaskLocation & { latitude: number; longitude: number } {
  return CoordinatesSchema.safeParse({
    latitude: location?.latitude,
    longitude: location?.longitude,
  }).success;
}

function optionalAccuracy(value: unknown): number | undefined {
  const parsed = z.number().finite().nonnegative().safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function optionalCapturedAt(value: unknown): string | undefined {
  const parsed = z.string().datetime().safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

/**
 * Adapts the repository's backward-compatible flat task fields to the shared
 * location model. Invalid or half-present coordinate pairs are deliberately
 * ignored instead of inventing the missing value.
 */
export function taskLocationFromFlat(task: FlatTaskLocationFields): TaskLocation | null {
  const rawName = typeof task.place === "string" ? task.place.trim() : "";
  const coordinates = CoordinatesSchema.safeParse({ latitude: task.lat, longitude: task.lng });
  if (!rawName && !coordinates.success) return null;

  const parsedSource = LocationSourceSchema.safeParse(task.locationSource);
  const candidate: TaskLocation = {
    name: rawName || "ตำแหน่งที่เลือก",
    source: parsedSource.success ? parsedSource.data : "manual",
    ...(coordinates.success ? coordinates.data : {}),
  };
  const accuracy = optionalAccuracy(task.locationAccuracy);
  const capturedAt = optionalCapturedAt(task.locationCapturedAt);
  if (accuracy != null && coordinates.success) candidate.accuracy = accuracy;
  if (capturedAt && coordinates.success) candidate.capturedAt = capturedAt;
  return TaskLocationSchema.parse(candidate);
}

/** Converts shared location state back to the current flat Task schema fields. */
export function taskLocationToFlat(location: TaskLocation | null | undefined): FlatTaskLocationPatch {
  if (!location) {
    return {
      place: "",
      lat: undefined,
      lng: undefined,
      locationSource: undefined,
      locationAccuracy: undefined,
      locationCapturedAt: undefined,
    };
  }
  const parsed = TaskLocationSchema.parse(location);
  return {
    place: parsed.name,
    lat: parsed.latitude,
    lng: parsed.longitude,
    locationSource: parsed.source,
    locationAccuracy: parsed.accuracy,
    locationCapturedAt: parsed.capturedAt,
  };
}

export function currentLocationToTaskLocation(location: CurrentLocation): TaskLocation {
  const parsed = CurrentLocationSchema.parse(location);
  return TaskLocationSchema.parse({
    name: parsed.placeName ?? "ตำแหน่งปัจจุบัน",
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    source: parsed.source,
    accuracy: parsed.accuracy,
    capturedAt: parsed.capturedAt,
  });
}

/**
 * Existing quick-place data remains the source of suggestions. "บ้าน" is a
 * semantic shortcut only: the historical coordinate was synthetic, so it must
 * never be treated as the user's actual home.
 */
export const DEFAULT_QUICK_LOCATIONS: readonly TaskLocation[] = [
  TaskLocationSchema.parse({ name: "บ้าน", source: "quick" }),
  ...Object.entries(BKK_PLACES).map(([, place]) => TaskLocationSchema.parse({
    name: place.name,
    latitude: place.lat,
    longitude: place.lng,
    source: "quick",
  })),
];
