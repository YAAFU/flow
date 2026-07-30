import { describe, expect, it } from "vitest";
import {
  CoordinatesSchema,
  DEFAULT_QUICK_LOCATIONS,
  TaskLocationSchema,
  currentLocationToTaskLocation,
  taskLocationFromFlat,
  taskLocationToFlat,
} from "@/lib/location";

describe("location domain", () => {
  it("validates coordinate ranges and requires a complete pair", () => {
    expect(CoordinatesSchema.safeParse({ latitude: 13.75, longitude: 100.5 }).success).toBe(true);
    expect(CoordinatesSchema.safeParse({ latitude: 91, longitude: 100.5 }).success).toBe(false);
    expect(TaskLocationSchema.safeParse({ name: "อโศก", latitude: 13.73, source: "search" }).success).toBe(false);
  });

  it("keeps the home quick action name-only instead of using the synthetic coordinate", () => {
    const home = DEFAULT_QUICK_LOCATIONS.find((location) => location.name === "บ้าน");
    const siam = DEFAULT_QUICK_LOCATIONS.find((location) => location.name === "สยาม");
    expect(home).toEqual({ name: "บ้าน", source: "quick" });
    expect(siam).toMatchObject({ name: "สยาม", source: "quick", latitude: 13.746, longitude: 100.534 });
  });

  it("round-trips the current flat task fields without inventing missing coordinates", () => {
    const location = taskLocationFromFlat({
      place: "ออฟฟิศ",
      lat: 13.7,
      lng: 100.5,
      locationSource: "live",
      locationAccuracy: 18,
      locationCapturedAt: "2026-07-21T08:00:00.000Z",
    });
    expect(location).toEqual({
      name: "ออฟฟิศ",
      latitude: 13.7,
      longitude: 100.5,
      source: "live",
      accuracy: 18,
      capturedAt: "2026-07-21T08:00:00.000Z",
    });
    expect(taskLocationToFlat(location)).toEqual({
      place: "ออฟฟิศ",
      lat: 13.7,
      lng: 100.5,
      locationSource: "live",
      locationAccuracy: 18,
      locationCapturedAt: "2026-07-21T08:00:00.000Z",
    });

    expect(taskLocationFromFlat({ place: "บ้าน", lat: 13.7 })).toEqual({ name: "บ้าน", source: "manual" });
  });

  it("adapts a live browser location to task location with a safe fallback name", () => {
    expect(currentLocationToTaskLocation({
      latitude: 13.75,
      longitude: 100.5,
      accuracy: 20,
      capturedAt: "2026-07-21T08:00:00.000Z",
      source: "live",
    })).toEqual({
      name: "ตำแหน่งปัจจุบัน",
      latitude: 13.75,
      longitude: 100.5,
      accuracy: 20,
      capturedAt: "2026-07-21T08:00:00.000Z",
      source: "live",
    });
  });
});
