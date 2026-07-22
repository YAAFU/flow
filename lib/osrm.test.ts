import { afterEach, describe, expect, it, vi } from "vitest";
import { durationTable, roadRoute, travelLegDisplay } from "@/lib/osrm";

const points = [
  { lat: 13.746, lng: 100.534 },
  { lat: 13.737, lng: 100.56 },
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OSRM unavailable state", () => {
  it("does not invent a duration matrix when routing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(durationTable(points)).resolves.toEqual({ durations: [], fallback: true });
  });

  it("does not draw a straight line or invent travel times when routing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(roadRoute(points)).resolves.toEqual({ geometry: [], legs: [], fallback: true });
  });
});

describe("travelLegDisplay", () => {
  it("uses only a real routing leg for displayed travel time", () => {
    expect(travelLegDisplay({ durationMin: 17, distanceKm: 6.4 }, true, false)).toEqual({
      kind: "ready",
      durationMin: 17,
      distanceKm: 6.4,
    });
  });

  it("never turns a missing or failed route into a zero-minute estimate", () => {
    expect(travelLegDisplay(null, true, false)).toEqual({ kind: "loading" });
    expect(travelLegDisplay(null, true, true)).toEqual({ kind: "unavailable" });
    expect(travelLegDisplay(null, false, false)).toEqual({ kind: "unavailable" });
  });
});
