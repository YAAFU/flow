import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapMock = vi.hoisted(() => ({
  handlers: new globalThis.Map<string, (event: { lngLat: { lat: number; lng: number } }) => void>(),
  throwOnConstruct: false,
  remove: vi.fn(),
  markerSetLngLat: vi.fn(),
  markerAddTo: vi.fn(),
}));

vi.mock("maplibre-gl", () => ({
  default: {
    Map: class {
      constructor() {
        if (mapMock.throwOnConstruct) throw new Error("map unavailable");
        mapMock.handlers.clear();
      }
      on(name: string, handler: (event: { lngLat: { lat: number; lng: number } }) => void) {
        mapMock.handlers.set(name, handler);
        return this;
      }
      off(name: string) {
        mapMock.handlers.delete(name);
        return this;
      }
      remove() { mapMock.remove(); }
    },
    Marker: class {
      setLngLat(value: [number, number]) {
        mapMock.markerSetLngLat(value);
        return this;
      }
      addTo(value: unknown) {
        mapMock.markerAddTo(value);
        return this;
      }
    },
  },
}));

import { LocationPicker } from "@/components/LocationPicker";

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function renderPicker(props: Partial<React.ComponentProps<typeof LocationPicker>> = {}) {
  act(() => {
    root?.render(
      <LocationPicker
        open
        onClose={vi.fn()}
        onPick={vi.fn()}
        {...props}
      />,
    );
  });
}

function confirmButton() {
  return [...(container?.querySelectorAll("button") ?? [])].find((button) => button.textContent?.includes("ใช้ตำแหน่งนี้")) as HTMLButtonElement | undefined;
}

beforeEach(() => {
  mapMock.handlers.clear();
  mapMock.throwOnConstruct = false;
  mapMock.remove.mockReset();
  mapMock.markerSetLngLat.mockReset();
  mapMock.markerAddTo.mockReset();
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

describe("LocationPicker", () => {
  it("clears the old place name and blocks confirmation while a new pin is resolving", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: "สถานที่เดิม" }), { status: 200 }))
      .mockReturnValueOnce(new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    renderPicker();

    await act(async () => {
      mapMock.handlers.get("click")?.({ lngLat: { lat: 13.7, lng: 100.5 } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container?.textContent).toContain("สถานที่เดิม");
    expect(confirmButton()?.disabled).toBe(false);

    await act(async () => {
      mapMock.handlers.get("click")?.({ lngLat: { lat: 13.8, lng: 100.6 } });
      await Promise.resolve();
    });
    expect(container?.textContent).not.toContain("สถานที่เดิม");
    expect(container?.textContent).toContain("กำลังหาชื่อ");
    expect(confirmButton()?.disabled).toBe(true);
  });

  it("resets a previous pin whenever the picker is reopened", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: "จุดเดิม" }), { status: 200 })));
    renderPicker();
    await act(async () => {
      mapMock.handlers.get("click")?.({ lngLat: { lat: 13.7, lng: 100.5 } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container?.textContent).toContain("จุดเดิม");

    renderPicker({ open: false });
    renderPicker({ open: true });
    expect(container?.textContent).toContain("ยังไม่ได้ปักหมุด");
    expect(container?.textContent).not.toContain("จุดเดิม");
    expect(confirmButton()?.disabled).toBe(true);
  });

  it("shows map service failures without logging or enabling a stale confirmation", async () => {
    mapMock.throwOnConstruct = true;
    renderPicker();
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1));
    });

    expect(container?.querySelector('[role="status"]')?.textContent).toContain("เปิดแผนที่ไม่ได้");
    expect(confirmButton()?.disabled).toBe(true);
  });

  it("surfaces a recoverable map error while keeping cancel available", async () => {
    renderPicker();
    await act(async () => {
      mapMock.handlers.get("error")?.({ lngLat: { lat: 0, lng: 0 } });
      await Promise.resolve();
    });

    expect(container?.querySelector('[role="status"]')?.textContent).toContain("โหลดข้อมูลแผนที่บางส่วนไม่สำเร็จ");
    expect([...container!.querySelectorAll("button")].some((button) => button.textContent?.includes("ยกเลิก"))).toBe(true);
  });

  it("keeps a pin usable and reports when reverse geocoding fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: "หมุดที่ปัก" }), { status: 200 })));
    renderPicker();
    await act(async () => {
      mapMock.handlers.get("click")?.({ lngLat: { lat: 13.7, lng: 100.5 } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(container?.textContent).toContain("หาชื่อสถานที่ไม่ได้ แต่ยังใช้พิกัดหมุดนี้ได้");
    expect(confirmButton()?.disabled).toBe(false);
    expect(fetch).toHaveBeenCalledWith("/api/geocode", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ latitude: 13.7, longitude: 100.5 }),
    }));
  });
});
