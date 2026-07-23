import { describe, expect, it } from "vitest";
import { buildSavedPlace, findSavedPlaceMention, rankPlaceSuggestions, recordRecentPlace, savedPlaceToLocation } from "@/lib/smart-places";

const now = new Date("2026-07-23T11:00:00.000Z");

describe("smart places", () => {
  it("creates a saved place without inventing coordinates", () => {
    const place = buildSavedPlace({ id: "home", label: "บ้าน", category: "home", now });
    expect(place).toMatchObject({ id: "home", label: "บ้าน", placeName: "บ้าน", category: "home" });
    expect(place.latitude).toBeUndefined();
    expect(place.longitude).toBeUndefined();
  });

  it("updates a saved place without changing its id or created timestamp", () => {
    const existing = buildSavedPlace({ id: "home", label: "บ้าน", category: "home", now });
    const updated = buildSavedPlace({ existing, label: "บ้านใหม่", placeName: "บางนา", now: new Date("2026-07-24T01:00:00.000Z") });
    expect(updated.id).toBe("home");
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.label).toBe("บ้านใหม่");
  });

  it("deduplicates, promotes and limits recent places", () => {
    let recent = recordRecentPlace([], { name: "สยาม", source: "search" }, { usedAt: now });
    recent = recordRecentPlace(recent, { name: "อโศก", source: "search" }, { usedAt: new Date("2026-07-23T12:00:00.000Z") });
    recent = recordRecentPlace(recent, { name: "สยาม", source: "recent" }, { usedAt: new Date("2026-07-23T13:00:00.000Z") });
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ placeName: "สยาม", useCount: 2 });
    recent = recordRecentPlace(recent, { name: "สยาม", latitude: 13.746, longitude: 100.534, source: "search" }, { usedAt: new Date("2026-07-23T14:00:00.000Z") });
    expect(recent.filter((place) => place.placeName === "สยาม")).toHaveLength(1);
    expect(recent[0]).toMatchObject({ placeName: "สยาม", useCount: 3, latitude: 13.746, longitude: 100.534 });
    for (let index = 0; index < 6; index += 1) {
      recent = recordRecentPlace(recent, { name: `สถานที่ ${index}`, source: "search" }, { usedAt: new Date(now.getTime() + (index + 3) * 60 * 60_000) });
    }
    expect(recent).toHaveLength(5);
    expect(recent[0].placeName).toBe("สถานที่ 5");
  });

  it("ranks a contextual saved place ahead of recent-only places and can be disabled", () => {
    const home = buildSavedPlace({ id: "home", label: "บ้าน", category: "home", now });
    const recent = recordRecentPlace([], savedPlaceToLocation(home), { usedAt: now, categoryId: "personal" });
    recent.push(...recordRecentPlace([], { name: "หอสมุด", source: "search" }, { usedAt: now }));
    expect(rankPlaceSuggestions([home], recent, { date: "2026-07-23", hour: 18, categoryId: "personal" })[0].savedPlaceId).toBe("home");
    expect(rankPlaceSuggestions([home], recent, {}, false)).toEqual([]);
  });

  it("resolves a natural-language alias locally", () => {
    const home = buildSavedPlace({ id: "home", label: "บ้าน", placeName: "คอนโด", category: "home", latitude: 13.7, longitude: 100.5, now });
    expect(findSavedPlaceMention("กลับบ้านตอน 4 โมง", [home])?.id).toBe("home");
  });
});
