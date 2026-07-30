import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowMapProps, MapTaskItem } from "@/components/FlowMap";

type TestMap = {
  options: Record<string, unknown>;
  emit: (event: string, payload?: unknown) => void;
  remove: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  fitBounds: ReturnType<typeof vi.fn>;
  easeTo: ReturnType<typeof vi.fn>;
  flyTo: ReturnType<typeof vi.fn>;
  addSource: ReturnType<typeof vi.fn>;
  addLayer: ReturnType<typeof vi.fn>;
  getSource: (id: string) => { setData: ReturnType<typeof vi.fn> } | undefined;
};

type TestMarker = {
  element: HTMLElement;
  coordinates?: [number, number];
  removed: boolean;
  remove: ReturnType<typeof vi.fn>;
};

type TestResizeObserver = {
  callback: ResizeObserverCallback;
  observe: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const mapMock = vi.hoisted(() => ({
  instances: [] as TestMap[],
  markers: [] as TestMarker[],
  observers: [] as TestResizeObserver[],
  autoLoad: true,
  styleLoaded: true,
  constructorThrows: false,
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    options: Record<string, unknown>;
    listeners = new Map<string, Set<(payload?: unknown) => void>>();
    sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
    layers = new Set<string>();
    remove = vi.fn();
    resize = vi.fn();
    fitBounds = vi.fn();
    easeTo = vi.fn();
    flyTo = vi.fn();
    stop = vi.fn();
    addSource = vi.fn((id: string) => {
      this.sources.set(id, { setData: vi.fn() });
    });
    getSource = (id: string) => this.sources.get(id);
    removeSource = vi.fn((id: string) => {
      this.sources.delete(id);
    });
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.add(layer.id);
    });
    getLayer = (id: string) => (this.layers.has(id) ? { id } : undefined);
    removeLayer = vi.fn((id: string) => {
      this.layers.delete(id);
    });
    isStyleLoaded = () => mapMock.styleLoaded;

    constructor(options: Record<string, unknown>) {
      if (mapMock.constructorThrows) throw new Error("constructor failed");
      this.options = options;
      mapMock.instances.push(this as unknown as TestMap);
      if (mapMock.autoLoad) {
        queueMicrotask(() => {
          this.emit("style.load");
          this.emit("load");
        });
      }
    }

    on(event: string, callback: (payload?: unknown) => void) {
      const handlers = this.listeners.get(event) ?? new Set();
      handlers.add(callback);
      this.listeners.set(event, handlers);
      return this;
    }

    off(event: string, callback: (payload?: unknown) => void) {
      this.listeners.get(event)?.delete(callback);
      return this;
    }

    emit(event: string, payload?: unknown) {
      for (const callback of this.listeners.get(event) ?? []) callback(payload);
    }
  }

  class MockMarker {
    element: HTMLElement;
    coordinates?: [number, number];
    removed = false;
    remove = vi.fn(() => {
      this.removed = true;
    });

    constructor(options: { element: HTMLElement }) {
      this.element = options.element;
      mapMock.markers.push(this as unknown as TestMarker);
    }

    setLngLat(coordinates: [number, number]) {
      this.coordinates = coordinates;
      return this;
    }

    addTo() {
      return this;
    }
  }

  class MockLngLatBounds {
    points: [number, number][];

    constructor(sw: [number, number], ne: [number, number]) {
      this.points = [sw, ne];
    }

    extend(point: [number, number]) {
      this.points.push(point);
      return this;
    }
  }

  return {
    default: {
      Map: MockMap,
      Marker: MockMarker,
      LngLatBounds: MockLngLatBounds,
    },
  };
});

import { BKK_CENTER } from "@/lib/places";
import { FlowMap } from "@/components/FlowMap";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let fetchMock: ReturnType<typeof vi.fn>;
const originalStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL;

function item(overrides: Partial<MapTaskItem> = {}): MapTaskItem {
  return {
    taskId: "task-1",
    title: "ทำงาน",
    scheduled: false,
    ...overrides,
  };
}

function response(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: vi.fn(async () => data),
  } as unknown as Response;
}

function defaultFetch(input: RequestInfo | URL) {
  const url = String(input);
  if (url === "/api/route") {
    return Promise.resolve(
      response({
        fallback: false,
        geometry: [
          [100.5, 13.7],
          [100.6, 13.8],
        ],
        legs: [{ durationMin: 20, distanceKm: 8 }],
      }),
    );
  }
  return Promise.resolve(response([]));
}

function renderMap(items: MapTaskItem[], props: Partial<FlowMapProps> = {}) {
  act(() => {
    root?.render(<FlowMap items={items} online {...props} />);
  });
}

async function flushMap() {
  await act(async () => {
    for (let index = 0; index < 8; index += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  mapMock.instances.length = 0;
  mapMock.markers.length = 0;
  mapMock.observers.length = 0;
  mapMock.autoLoad = true;
  mapMock.styleLoaded = true;
  mapMock.constructorThrows = false;
  process.env.NEXT_PUBLIC_MAP_STYLE_URL = originalStyleUrl;

  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  class MockResizeObserver {
    callback: ResizeObserverCallback;
    observe = vi.fn();
    disconnect = vi.fn();

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
      mapMock.observers.push(this as unknown as TestResizeObserver);
    }
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);

  fetchMock = vi.fn(defaultFetch);
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  process.env.NEXT_PUBLIC_MAP_STYLE_URL = originalStyleUrl;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FlowMap basemap lifecycle", () => {
  it("initializes at Bangkok even when there are no items and shows an empty state", async () => {
    renderMap([]);
    await flushMap();

    expect(mapMock.instances).toHaveLength(1);
    expect(mapMock.instances[0].options).toMatchObject({
      center: [BKK_CENTER.lng, BKK_CENTER.lat],
      zoom: 10.5,
    });
    expect(container?.textContent).toContain(
      "ยังไม่มีงานสำหรับแสดงบนแผนที่",
    );
    expect(
      container?.querySelector('[data-testid="flow-map-canvas"]'),
    ).toBeTruthy();
  });

  it("does not recreate MapLibre when items or coordinates change", async () => {
    renderMap([
      item({ lat: 13.74, lng: 100.53, placeLabel: "จุดแรก" }),
    ]);
    await flushMap();
    renderMap([
      item({ lat: 13.75, lng: 100.54, placeLabel: "จุดใหม่" }),
    ]);
    await flushMap();

    expect(mapMock.instances).toHaveLength(1);
    expect(mapMock.markers.filter((marker) => !marker.removed)).toHaveLength(1);
    expect(mapMock.markers[0].removed).toBe(true);
  });

  it("keeps the loaded MapLibre instance across offline and online transitions", async () => {
    renderMap([]);
    await flushMap();
    expect(mapMock.instances).toHaveLength(1);

    act(() => {
      root?.render(<FlowMap items={[]} online={false} />);
    });
    act(() => {
      root?.render(<FlowMap items={[]} online />);
    });
    await flushMap();

    expect(mapMock.instances).toHaveLength(1);
    expect(mapMock.instances[0].remove).not.toHaveBeenCalled();
  });

  it("keeps one grouped marker for tasks at the same coordinates", async () => {
    renderMap([
      item({ taskId: "one", lat: 13.74, lng: 100.53 }),
      item({ taskId: "two", lat: 13.74, lng: 100.53 }),
    ]);
    await flushMap();

    expect(mapMock.markers).toHaveLength(1);
    expect(mapMock.markers[0].element.textContent).toBe("1, 2");
  });

  it("updates a reused marker click target after task order changes", async () => {
    const onFocus = vi.fn();
    renderMap([
      item({ taskId: "without-point" }),
      item({ taskId: "located", lat: 13.74, lng: 100.53 }),
    ], { onFocus });
    await flushMap();

    renderMap([
      item({ taskId: "located", lat: 13.74, lng: 100.53 }),
    ], { onFocus });
    await flushMap();
    mapMock.markers[0].element.click();

    expect(onFocus).toHaveBeenLastCalledWith(0);
  });

  it("treats a resource error as non-fatal", async () => {
    renderMap([]);
    await flushMap();

    act(() => {
      mapMock.instances[0].emit("error", {
        error: new Error("one tile failed"),
      });
    });

    expect(container?.textContent).toContain(
      "พื้นแผนที่บางส่วนอาจแสดงไม่ครบ",
    );
    expect(container?.textContent).not.toContain(
      "ยังเปิดพื้นแผนที่ไม่ได้",
    );
    expect(mapMock.instances[0].remove).not.toHaveBeenCalled();
  });

  it("shows a fatal style timeout and only creates a new map after Retry", async () => {
    vi.useFakeTimers();
    mapMock.autoLoad = false;
    mapMock.styleLoaded = false;
    renderMap([]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_100);
    });
    expect(container?.textContent).toContain("ยังเปิดพื้นแผนที่ไม่ได้");
    expect(mapMock.instances).toHaveLength(1);

    mapMock.autoLoad = true;
    mapMock.styleLoaded = true;
    const retry = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("ลองโหลดแผนที่ใหม่"),
    );
    act(() => retry?.click());
    await flushMap();

    expect(mapMock.instances).toHaveLength(2);
  });

  it("does not crash when an invalid configured style cannot load", async () => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_MAP_STYLE_URL = "not-a-valid-style";
    mapMock.autoLoad = false;
    mapMock.styleLoaded = false;
    renderMap([]);

    expect(mapMock.instances[0].options.style).toBe("not-a-valid-style");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_100);
    });
    expect(container?.textContent).toContain("ยังเปิดพื้นแผนที่ไม่ได้");
  });
});

describe("FlowMap markers and routing", () => {
  it("shows an unscheduled marker and does not request a route for one point", async () => {
    renderMap([
      item({
        placeLabel: "หอสมุด",
        lat: 13.744,
        lng: 100.532,
        scheduled: false,
      }),
    ]);
    await flushMap();

    expect(mapMock.markers).toHaveLength(1);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === "/api/route"),
    ).toBe(false);
  });

  it("does not route a point without a complete scheduled time", async () => {
    renderMap([
      item({
        lat: 13.744,
        lng: 100.532,
        scheduled: true,
        start: "09:00",
        end: undefined,
      }),
      item({
        taskId: "task-2",
        lat: 13.78,
        lng: 100.56,
        scheduled: true,
        start: "11:00",
        end: "12:00",
      }),
    ]);
    await flushMap();

    expect(mapMock.markers).toHaveLength(2);
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === "/api/route"),
    ).toBe(false);
  });

  it("requests a road route only when at least two scheduled points exist", async () => {
    renderMap([
      item({
        lat: 13.744,
        lng: 100.532,
        scheduled: true,
        start: "09:00",
        end: "10:00",
      }),
      item({
        taskId: "task-2",
        lat: 13.78,
        lng: 100.56,
        scheduled: true,
        start: "11:00",
        end: "12:00",
      }),
    ]);
    await flushMap();

    const routeCalls = fetchMock.mock.calls.filter(
      ([input]) => String(input) === "/api/route",
    );
    expect(routeCalls).toHaveLength(1);
    expect(mapMock.instances[0].addSource).toHaveBeenCalledTimes(1);
    expect(mapMock.instances[0].addLayer).toHaveBeenCalledTimes(1);
  });

  it("orders routed points chronologically without changing marker availability", async () => {
    renderMap([
      item({
        taskId: "late",
        lat: 13.78,
        lng: 100.56,
        scheduled: true,
        start: "15:00",
        end: "16:00",
      }),
      item({
        taskId: "early",
        lat: 13.744,
        lng: 100.532,
        scheduled: true,
        start: "09:00",
        end: "10:00",
      }),
    ]);
    await flushMap();

    const routeCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/route",
    );
    const body = JSON.parse(String(routeCall?.[1]?.body));
    expect(body.coords).toEqual([
      { lat: 13.744, lng: 100.532 },
      { lat: 13.78, lng: 100.56 },
    ]);
    expect(mapMock.markers).toHaveLength(2);
  });

  it("keeps the basemap and markers when routing fails", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      String(input) === "/api/route"
        ? Promise.resolve(response({ error: "down" }, false, 503))
        : defaultFetch(input),
    );
    renderMap([
      item({
        lat: 13.744,
        lng: 100.532,
        scheduled: true,
        start: "09:00",
        end: "10:00",
      }),
      item({
        taskId: "task-2",
        lat: 13.78,
        lng: 100.56,
        scheduled: true,
        start: "11:00",
        end: "12:00",
      }),
    ]);
    await flushMap();

    expect(mapMock.markers).toHaveLength(2);
    expect(mapMock.instances[0].remove).not.toHaveBeenCalled();
    expect(container?.textContent).toContain(
      "ยังคำนวณเส้นทางถนนไม่ได้ แต่คุณยังดูตำแหน่งงานได้",
    );
  });
});

describe("FlowMap geocoding", () => {
  it("does not repeatedly geocode the same place after a successful lookup", async () => {
    fetchMock.mockResolvedValue(
      response([{ lat: 13.75, lng: 100.55 }]),
    );
    renderMap([item({ placeLabel: "สถานที่ใหม่" })]);
    await flushMap();
    await flushMap();

    const calls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/geocode?"),
    );
    expect(calls).toHaveLength(1);
    expect(mapMock.markers).toHaveLength(1);
  });

  it("keeps valid markers when one geocoding lookup fails", async () => {
    fetchMock.mockResolvedValue(response([]));
    renderMap([
      item({ taskId: "known", lat: 13.75, lng: 100.55 }),
      item({ taskId: "unknown", placeLabel: "หาไม่พบ" }),
    ]);
    await flushMap();

    expect(mapMock.markers).toHaveLength(1);
    expect(container?.textContent).toContain("ค้นหาบางสถานที่ไม่พบ");
    expect(container?.textContent).toContain("หาไม่พบ");
  });

  it("handles a non-array geocoding response without crashing", async () => {
    fetchMock.mockResolvedValue(response({ error: "invalid" }));
    renderMap([item({ placeLabel: "สถานที่ใหม่" })]);
    await flushMap();

    expect(mapMock.instances).toHaveLength(1);
    expect(container?.textContent).toContain(
      "ยังใช้บริการค้นหาตำแหน่งไม่ได้",
    );
  });

  it("does not leave a one-character place label in a loading state", async () => {
    renderMap([item({ placeLabel: "ก" })]);
    await flushMap();

    expect(container?.textContent).not.toContain("กำลังค้นหาตำแหน่ง");
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).startsWith("/api/geocode?"),
      ),
    ).toBe(false);
  });

  it("retries only failed geocoding entries", async () => {
    fetchMock
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response([{ lat: 13.76, lng: 100.56 }]));
    renderMap([item({ placeLabel: "ลองใหม่" })]);
    await flushMap();

    const retry = [...(container?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.includes("ลองค้นหาใหม่"),
    );
    expect(retry).toBeTruthy();
    act(() => retry?.click());
    await flushMap();

    const calls = fetchMock.mock.calls.filter(([input]) =>
      String(input).startsWith("/api/geocode?"),
    );
    expect(calls).toHaveLength(2);
    expect(mapMock.markers).toHaveLength(1);
  });
});

describe("FlowMap resize, offline recovery, and cleanup", () => {
  it("shows an offline state and initializes automatically when online returns", async () => {
    act(() => {
      root?.render(<FlowMap items={[]} online={false} />);
    });
    expect(container?.textContent).toContain("ขณะนี้อุปกรณ์ออฟไลน์");
    expect(mapMock.instances).toHaveLength(0);

    act(() => {
      root?.render(<FlowMap items={[]} online />);
    });
    await flushMap();
    expect(mapMock.instances).toHaveLength(1);
    expect(container?.textContent).toContain(
      "ยังไม่มีงานสำหรับแสดงบนแผนที่",
    );
  });

  it("resizes when its container changes size", async () => {
    renderMap([]);
    await flushMap();
    const before = mapMock.instances[0].resize.mock.calls.length;

    act(() => {
      mapMock.observers[0].callback([], mapMock.observers[0] as unknown as ResizeObserver);
    });

    expect(mapMock.instances[0].resize.mock.calls.length).toBeGreaterThan(before);
  });

  it("cleans up the map, markers, and ResizeObserver on unmount", async () => {
    renderMap([item({ lat: 13.74, lng: 100.53 })]);
    await flushMap();
    const map = mapMock.instances[0];
    const marker = mapMock.markers[0];
    const observer = mapMock.observers[0];

    act(() => root?.unmount());
    root = undefined;

    expect(map.remove).toHaveBeenCalled();
    expect(marker.remove).toHaveBeenCalled();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("contains horizontal overflow on narrow map layouts", async () => {
    renderMap([]);
    await flushMap();

    expect(
      container?.querySelector("section")?.className,
    ).toContain("overflow-x-hidden");
  });
});
