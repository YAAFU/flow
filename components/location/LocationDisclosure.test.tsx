import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskLocation } from "@/lib/location";

const liveMock = vi.hoisted(() => ({
  request: vi.fn(),
  reset: vi.fn(),
  status: "idle",
  location: null as null | { latitude: number; longitude: number; accuracy?: number; placeName?: string; capturedAt: string; source: "live" },
  reverseGeocodeFailed: false,
}));

vi.mock("@/components/LocationPicker", () => ({ LocationPicker: () => null }));
vi.mock("@/hooks/useCurrentLocation", () => ({
  useCurrentLocation: () => ({
    status: liveMock.status,
    location: liveMock.location,
    reverseGeocodeFailed: liveMock.reverseGeocodeFailed,
    error: null,
    isLoading: liveMock.status === "loading",
    request: liveMock.request,
    reset: liveMock.reset,
  }),
}));

import { LocationDisclosure } from "@/components/location/LocationDisclosure";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function setInputValue(element: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function renderDisclosure(onChange = vi.fn(), onBusyChange?: (busy: boolean) => void) {
  const quickLocations: TaskLocation[] = [{ name: "บ้าน", source: "quick" }];
  act(() => {
    root?.render(<LocationDisclosure value={null} onChange={onChange} onBusyChange={onBusyChange} defaultExpanded quickLocations={quickLocations} />);
  });
  return onChange;
}

beforeEach(() => {
  liveMock.request.mockReset();
  liveMock.reset.mockReset();
  liveMock.status = "idle";
  liveMock.location = null;
  liveMock.reverseGeocodeFailed = false;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
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

describe("LocationDisclosure accessibility", () => {
  it("treats quick locations as a group, announces success, and restores focus", async () => {
    const onChange = renderDisclosure();
    const group = container?.querySelector('[role="group"][aria-label="สถานที่ด่วน"]');
    const quickButton = [...(group?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.includes("บ้าน")) as HTMLButtonElement | undefined;
    expect(quickButton).toBeTruthy();

    await act(async () => {
      quickButton?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 1));
    });

    expect(onChange).toHaveBeenCalledWith({ name: "บ้าน", source: "quick" });
    expect(container?.querySelector('[role="status"][aria-live="polite"]')?.textContent).toContain("เลือกสถานที่ บ้าน แล้ว");
    expect(document.activeElement).toBe(container?.querySelector('input[placeholder="ค้นหาสถานที่"]'));
  });

  it("shows saved, suggested and recent sections without requesting geolocation", () => {
    const stamp = "2026-07-23T08:00:00.000Z";
    act(() => {
      root?.render(<LocationDisclosure
        value={null}
        onChange={vi.fn()}
        defaultExpanded
        savedPlaces={[{ id: "home", label: "บ้าน", placeName: "คอนโด", category: "home", createdAt: stamp, updatedAt: stamp }]}
        recentPlaces={[{ placeKey: "library||", placeName: "หอสมุด", lastUsedAt: stamp, useCount: 2 }]}
        suggestions={[{ key: "home", location: { name: "บ้าน", source: "suggested" }, reason: "ใช้ล่าสุดเมื่อวาน", score: 100 }]}
      />);
    });
    expect(container?.textContent).toContain("สถานที่ประจำ");
    expect(container?.textContent).toContain("แนะนำสำหรับคุณ");
    expect(container?.textContent).toContain("ล่าสุด");
    expect(container?.textContent).toContain("คอนโด");
    expect(liveMock.request).not.toHaveBeenCalled();
  });

  it("offers a frequent recent place once and promotes it only after confirmation", () => {
    const stamp = "2026-07-23T08:00:00.000Z";
    const frequent = { placeKey: "library||", placeName: "หอสมุด", lastUsedAt: stamp, useCount: 3 };
    const onPromoteRecentPlace = vi.fn();
    act(() => {
      root?.render(<LocationDisclosure
        value={null}
        onChange={vi.fn()}
        defaultExpanded
        recentPlaces={[frequent]}
        onPromoteRecentPlace={onPromoteRecentPlace}
      />);
    });
    expect(container?.textContent).toContain("ต้องการบันทึกเป็นสถานที่ประจำไหม");
    const promote = [...(container?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes("บันทึกเป็นสถานที่ประจำ")) as HTMLButtonElement | undefined;
    act(() => promote?.click());
    expect(onPromoteRecentPlace).toHaveBeenCalledWith(frequent);
  });

  it("restores focus after choosing a search result", async () => {
    const onChange = renderDisclosure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { name: "อารีย์", lat: 13.7798, lng: 100.5447 },
    ]), { status: 200 })));
    const searchInput = container?.querySelector<HTMLInputElement>('input[placeholder="ค้นหาสถานที่"]');
    expect(searchInput).toBeTruthy();
    setInputValue(searchInput!, "อารีย์");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 380));
    });
    const result = [...(container?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.includes("อารีย์")) as HTMLButtonElement | undefined;
    expect(result).toBeTruthy();

    await act(async () => {
      result?.click();
      await new Promise((resolve) => window.setTimeout(resolve, 1));
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: "อารีย์", source: "search", latitude: 13.7798, longitude: 100.5447 }));
    expect(document.activeElement).toBe(searchInput);
  });

  it("announces low accuracy and reverse-geocoding failure as independent facts", () => {
    liveMock.status = "inaccurate";
    liveMock.reverseGeocodeFailed = true;
    liveMock.location = {
      latitude: 13.7,
      longitude: 100.5,
      accuracy: 620,
      placeName: "ตำแหน่งปัจจุบัน",
      capturedAt: "2026-07-21T08:00:00.000Z",
      source: "live",
    };
    renderDisclosure();

    const text = container?.textContent ?? "";
    expect(text).toContain("ความแม่นยำค่อนข้างต่ำ");
    expect(text).toContain("±620 เมตร");
    expect(text).toContain("ยังหาชื่อสถานที่ไม่ได้");
  });

  it("reports live-location loading to the owning form and clears it on unmount", () => {
    const onBusyChange = vi.fn();
    renderDisclosure(vi.fn(), onBusyChange);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    liveMock.status = "loading";
    renderDisclosure(vi.fn(), onBusyChange);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    liveMock.status = "unsupported";
    renderDisclosure(vi.fn(), onBusyChange);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);

    act(() => root?.unmount());
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    root = undefined;
  });
});
