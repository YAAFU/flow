import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsSchema, type SavedPlace } from "@/lib/types";

vi.mock("@/components/location/LocationDisclosure", () => ({
  LocationDisclosure: () => <div data-testid="location-disclosure" />,
}));

import { SavedPlacesManager } from "@/components/location/SavedPlacesManager";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function clickButton(label: string) {
  const match = [...(container?.querySelectorAll("button") ?? [])].find((button) =>
    button.textContent?.includes(label) || button.getAttribute("aria-label")?.includes(label),
  ) as HTMLButtonElement | undefined;
  act(() => match?.click());
  return match;
}

function setInput(placeholder: string, value: string) {
  const input = container?.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  vi.unstubAllGlobals();
});

describe("SavedPlacesManager", () => {
  it("adds a named place without inventing coordinates", () => {
    const onSave = vi.fn();
    act(() => root?.render(<SavedPlacesManager
      savedPlaces={[]}
      recentPlaces={[]}
      settings={AppSettingsSchema.parse({})}
      onSave={onSave}
      onDelete={vi.fn()}
      onClearRecent={vi.fn()}
      onSettings={vi.fn()}
    />));
    clickButton("เพิ่มสถานที่ประจำ");
    setInput("เช่น บ้าน โรงเรียน ที่ทำงาน", "บ้าน");
    clickButton("บันทึกสถานที่ประจำ");
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ label: "บ้าน", placeName: "บ้าน", category: "custom" }));
    const saved = onSave.mock.calls[0][0] as SavedPlace;
    expect(saved.latitude).toBeUndefined();
    expect(saved.longitude).toBeUndefined();
  });

  it("requires confirmation before deleting and leaves task snapshots to the store", () => {
    const place: SavedPlace = {
      id: "home",
      label: "บ้าน",
      placeName: "คอนโด",
      category: "home",
      createdAt: "2026-07-23T00:00:00.000Z",
      updatedAt: "2026-07-23T00:00:00.000Z",
    };
    const onDelete = vi.fn();
    act(() => root?.render(<SavedPlacesManager
      savedPlaces={[place]}
      recentPlaces={[]}
      settings={AppSettingsSchema.parse({})}
      onSave={vi.fn()}
      onDelete={onDelete}
      onClearRecent={vi.fn()}
      onSettings={vi.fn()}
    />));
    clickButton("ลบ บ้าน");
    expect(onDelete).not.toHaveBeenCalled();
    expect(container?.textContent).toContain("งานเก่าจะยังเก็บ snapshot");
    clickButton("ยืนยันลบ");
    expect(onDelete).toHaveBeenCalledWith("home");
  });
});
