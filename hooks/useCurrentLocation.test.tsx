import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentLocation, type UseCurrentLocationResult } from "@/hooks/useCurrentLocation";

let root: Root | undefined;
let container: HTMLDivElement | undefined;
let latest: UseCurrentLocationResult | undefined;
let originalGeolocation: PropertyDescriptor | undefined;

const fixedNow = () => new Date("2026-07-21T08:00:00.000Z");

function Harness({ onResult }: { onResult: (result: UseCurrentLocationResult) => void }) {
  const result = useCurrentLocation({ now: fixedNow });
  useEffect(() => onResult(result), [onResult, result]);
  return <button type="button" onClick={result.request}>request</button>;
}

type SuccessCallback = (position: GeolocationPosition) => unknown;
type ErrorCallback = (error: GeolocationPositionError) => unknown;

function mockGeolocation() {
  let success: SuccessCallback | undefined;
  let failure: ErrorCallback | undefined;
  const getCurrentPosition = vi.fn((onSuccess: PositionCallback, onError?: PositionErrorCallback | null) => {
    success = onSuccess as SuccessCallback;
    failure = (onError ?? undefined) as ErrorCallback | undefined;
  });
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition },
  });
  return {
    getCurrentPosition,
    succeed: (position = positionFixture()) => success?.(position),
    fail: (code: number) => failure?.({
      code,
      message: "geolocation error",
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3,
    } as GeolocationPositionError),
  };
}

function positionFixture(accuracy = 20): GeolocationPosition {
  return {
    coords: {
      latitude: 13.7367,
      longitude: 100.5601,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: 0,
    toJSON: () => ({}),
  } as GeolocationPosition;
}

function renderHook() {
  act(() => root?.render(<Harness onResult={(result) => { latest = result; }} />));
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  originalGeolocation = Object.getOwnPropertyDescriptor(navigator, "geolocation");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  latest = undefined;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  latest = undefined;
  if (originalGeolocation) Object.defineProperty(navigator, "geolocation", originalGeolocation);
  else Reflect.deleteProperty(navigator, "geolocation");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCurrentLocation", () => {
  it("does not request permission before the user calls request", () => {
    const geolocation = mockGeolocation();
    renderHook();
    expect(latest?.status).toBe("idle");
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("returns live coordinates and a reverse-geocoded place after success", async () => {
    const geolocation = mockGeolocation();
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ name: "อโศก" }),
    })));
    renderHook();

    act(() => latest?.request());
    expect(latest?.status).toBe("loading");
    await act(async () => { await geolocation.succeed(); });

    expect(latest?.status).toBe("success");
    expect(latest?.location).toEqual({
      latitude: 13.7367,
      longitude: 100.5601,
      accuracy: 20,
      placeName: "อโศก",
      capturedAt: "2026-07-21T08:00:00.000Z",
      source: "live",
    });
    expect(fetch).toHaveBeenCalledWith("/api/geocode", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ latitude: 13.7367, longitude: 100.5601 }),
      signal: expect.any(AbortSignal),
    }));
  });

  it("maps permission denied without reverse geocoding", () => {
    const geolocation = mockGeolocation();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    renderHook();
    act(() => latest?.request());
    act(() => { geolocation.fail(1); });
    expect(latest?.status).toBe("denied");
    expect(latest?.location).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports an unsupported browser without throwing", () => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
    renderHook();
    act(() => latest?.request());
    expect(latest?.status).toBe("unsupported");
    expect(latest?.location).toBeNull();
  });

  it("maps a browser timeout and remains retryable", () => {
    const geolocation = mockGeolocation();
    renderHook();
    act(() => latest?.request());
    act(() => { geolocation.fail(3); });
    expect(latest?.status).toBe("timeout");
    act(() => latest?.request());
    expect(latest?.status).toBe("loading");
    expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it("ignores an older overlapping request when a newer request has started", async () => {
    const successes: PositionCallback[] = [];
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: vi.fn((onSuccess: PositionCallback) => { successes.push(onSuccess); }),
      },
    });
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ name: "อโศก" }) }));
    vi.stubGlobal("fetch", fetcher);
    renderHook();

    act(() => latest?.request());
    act(() => latest?.request());
    expect(successes).toHaveLength(2);
    await act(async () => { await successes[0](positionFixture()); });
    expect(fetcher).not.toHaveBeenCalled();
    expect(latest?.status).toBe("loading");

    await act(async () => { await successes[1](positionFixture()); });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(latest?.location?.placeName).toBe("อโศก");
  });

  it("keeps usable coordinates when reverse geocoding fails", async () => {
    const geolocation = mockGeolocation();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    renderHook();
    act(() => latest?.request());
    await act(async () => { await geolocation.succeed(); });
    expect(latest?.status).toBe("success");
    expect(latest?.reverseGeocodeFailed).toBe(true);
    expect(latest?.location).toMatchObject({
      latitude: 13.7367,
      longitude: 100.5601,
      placeName: "ตำแหน่งปัจจุบัน",
    });
  });

  it("marks a low-accuracy result without discarding it", async () => {
    const geolocation = mockGeolocation();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ name: "กรุงเทพฯ" }) })));
    renderHook();
    act(() => latest?.request());
    await act(async () => { await geolocation.succeed(positionFixture(900)); });
    expect(latest?.status).toBe("inaccurate");
    expect(latest?.location?.accuracy).toBe(900);
  });

  it("keeps the low-accuracy warning when reverse geocoding also fails", async () => {
    const geolocation = mockGeolocation();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    renderHook();
    act(() => latest?.request());
    await act(async () => { await geolocation.succeed(positionFixture(900)); });
    expect(latest?.status).toBe("inaccurate");
    expect(latest?.reverseGeocodeFailed).toBe(true);
    expect(latest?.location?.accuracy).toBe(900);
  });

  it("ignores a late browser callback after unmount", async () => {
    const geolocation = mockGeolocation();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    renderHook();
    act(() => latest?.request());
    act(() => root?.unmount());
    await geolocation.succeed();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts in-flight reverse geocoding during cleanup", async () => {
    const geolocation = mockGeolocation();
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    }));
    renderHook();
    act(() => latest?.request());
    void geolocation.succeed();
    await act(async () => { await Promise.resolve(); });
    expect(signal?.aborted).toBe(false);
    act(() => root?.unmount());
    expect(signal?.aborted).toBe(true);
  });
});
