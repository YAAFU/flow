"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, MapPin, RotateCcw } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { BKK_CENTER, resolvePlace } from "@/lib/places";
import { travelLegDisplay, type RoadLeg } from "@/lib/osrm";

export const DEFAULT_MAP_STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const INITIAL_ZOOM = 10.5;
const STYLE_LOAD_TIMEOUT_MS = 12_000;
const REQUEST_TIMEOUT_MS = 8_000;
const ROUTE_SOURCE_ID = "flow-road-route";
const ROUTE_LAYER_ID = "flow-road-route-line";

export type MapTaskItem = {
  taskId: string;
  title: string;
  placeLabel?: string;
  lat?: number;
  lng?: number;
  start?: string;
  end?: string;
  scheduled: boolean;
};

export type GeocodingStatus =
  | "idle"
  | "loading"
  | "ready"
  | "partial"
  | "failed";

type BasemapStatus = "idle" | "loading" | "ready" | "partial" | "failed";
type RoutingStatus = "idle" | "loading" | "ready" | "failed";
type Point = { lat: number; lng: number };
type GeoCacheEntry =
  | { status: "loading" }
  | { status: "ready"; point: Point }
  | { status: "failed"; reason: "not_found" | "unavailable" };

type MapStop = MapTaskItem & {
  index: number;
  label: string;
  point?: Point;
};

type MarkerRecord = {
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
};

export type FlowMapProps = {
  items: MapTaskItem[];
  /**
   * Kept for callers that still provide coordinates separately. New callers
   * should put lat/lng directly on MapTaskItem.
   */
  coords?: Record<string, Point>;
  online?: boolean;
  focus?: number;
  onFocus?: React.Dispatch<React.SetStateAction<number>>;
  onEditTask?: (taskId: string) => void;
  onAddTask?: () => void;
};

function isValidPoint(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number"
    && typeof lng === "number"
    && Number.isFinite(lat)
    && Number.isFinite(lng)
    && Math.abs(lat) <= 90
    && Math.abs(lng) <= 180
  );
}

function pointFrom(lat: unknown, lng: unknown): Point | undefined {
  return isValidPoint(lat, lng) ? { lat, lng: lng as number } : undefined;
}

function normalizedLabel(label: string) {
  return label.trim().toLocaleLowerCase("th-TH");
}

function mapStyleUrl() {
  return process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_MAP_STYLE_URL;
}

function reducedMotion() {
  return (
    typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function routeGeometry(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const geometry = value
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
      const lng = Number(coordinate[0]);
      const lat = Number(coordinate[1]);
      return isValidPoint(lat, lng) ? ([lng, lat] as [number, number]) : null;
    })
    .filter((coordinate): coordinate is [number, number] => coordinate !== null);
  return geometry.length === value.length ? geometry : null;
}

function routeLegs(value: unknown, expectedCount: number): RoadLeg[] | null {
  if (!Array.isArray(value) || value.length !== expectedCount) return null;
  const legs = value.filter(
    (leg): leg is RoadLeg =>
      typeof leg === "object"
      && leg !== null
      && Number.isFinite((leg as RoadLeg).durationMin)
      && (leg as RoadLeg).durationMin >= 0
      && Number.isFinite((leg as RoadLeg).distanceKm)
      && (leg as RoadLeg).distanceKm >= 0,
  );
  return legs.length === expectedCount ? legs : null;
}

function markerKey(point: Point) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

export function FlowMap({
  items,
  coords,
  online: onlineProp,
  focus: focusProp,
  onFocus,
  onEditTask,
  onAddTask,
}: FlowMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const geoCacheRef = useRef<Map<string, GeoCacheEntry>>(new Map());
  const [geoCache, setGeoCache] = useState<Map<string, GeoCacheEntry>>(
    () => new Map(),
  );
  const previousOnlineRef = useRef<boolean | null>(null);

  const [detectedOnline, setDetectedOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const online = onlineProp ?? detectedOnline;
  const [mapCanInitialize, setMapCanInitialize] = useState(online);
  const [basemapStatus, setBasemapStatus] =
    useState<BasemapStatus>("idle");
  const [basemapMessage, setBasemapMessage] = useState("");
  const [mapGeneration, setMapGeneration] = useState(0);
  const [geocodeGeneration, setGeocodeGeneration] = useState(0);
  const [focusState, setFocusState] = useState(-1);
  const focus = focusProp ?? focusState;
  const setFocus = onFocus ?? setFocusState;
  const [routingStatus, setRoutingStatus] =
    useState<RoutingStatus>("idle");
  const [legs, setLegs] = useState<RoadLeg[]>([]);
  const [geometry, setGeometry] = useState<[number, number][]>([]);

  useEffect(() => {
    if (onlineProp !== undefined) return;
    const update = () => setDetectedOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [onlineProp]);

  useEffect(() => {
    if (previousOnlineRef.current === false && online) {
      for (const [label, entry] of geoCacheRef.current) {
        if (entry.status === "failed") geoCacheRef.current.delete(label);
      }
      setGeoCache(new Map(geoCacheRef.current));
      if (mapRef.current) {
        mapRef.current.resize();
      } else {
        setMapGeneration((generation) => generation + 1);
      }
    }
    previousOnlineRef.current = online;
  }, [online]);

  useEffect(() => {
    if (online) setMapCanInitialize(true);
  }, [online]);

  const stops = useMemo<MapStop[]>(() => {
    return items.map((item, index) => {
      const label = item.placeLabel?.trim() ?? "";
      const direct =
        pointFrom(item.lat, item.lng)
        ?? pointFrom(coords?.[item.taskId]?.lat, coords?.[item.taskId]?.lng);
      const builtIn = label ? resolvePlace(label) : undefined;
      const cached = label ? geoCache.get(normalizedLabel(label)) : undefined;
      const point =
        direct
        ?? pointFrom(builtIn?.lat, builtIn?.lng)
        ?? (cached?.status === "ready" ? cached.point : undefined);
      return { ...item, index, label, point };
    });
  }, [coords, geoCache, items]);

  const located = useMemo(
    () => stops.filter((stop): stop is MapStop & { point: Point } => Boolean(stop.point)),
    [stops],
  );
  const routeStops = useMemo(
    () =>
      located.filter(
        (stop) =>
          stop.scheduled
          && Boolean(stop.start?.trim())
          && Boolean(stop.end?.trim()),
      ).sort(
        (left, right) =>
          (left.start ?? "").localeCompare(right.start ?? "")
          || left.index - right.index,
      ),
    [located],
  );

  const geocodeCandidates = useMemo(
    () =>
      stops.filter(
        (stop) =>
          !stop.point
          && stop.label.length >= 2,
      ),
    [stops],
  );
  const geocodeCandidateKey = geocodeCandidates
    .map((stop) => normalizedLabel(stop.label))
    .sort()
    .join("|");

  const geocodingStatus = useMemo<GeocodingStatus>(() => {
    if (geocodeCandidates.length === 0) return "idle";
    const states = geocodeCandidates.map(
      (stop) => geoCache.get(normalizedLabel(stop.label))?.status,
    );
    if (states.some((status) => status === "loading" || status === undefined)) {
      return "loading";
    }
    const failedCount = states.filter((status) => status === "failed").length;
    if (failedCount === 0) return "ready";
    return located.length > 0 ? "partial" : "failed";
  }, [geoCache, geocodeCandidates, located.length]);
  const geocodingUnavailable = geocodeCandidates.some(
    (stop) =>
      geoCache.get(normalizedLabel(stop.label))?.status === "failed"
      && (
        geoCache.get(normalizedLabel(stop.label)) as
          | Extract<GeoCacheEntry, { status: "failed" }>
          | undefined
      )?.reason === "unavailable",
  );

  // Basemap lifecycle: one MapLibre instance per mount/generation, independent
  // of task and coordinate changes.
  useEffect(() => {
    if (!mapCanInitialize || !containerRef.current || mapRef.current) return;

    let disposed = false;
    let map: maplibregl.Map | null = null;
    let styleTimer: number | undefined = undefined;
    let resizeFrame: number | undefined;
    let observer: ResizeObserver | undefined;

    const clearMarkers = () => {
      for (const { marker } of markersRef.current.values()) {
        try {
          marker.remove();
        } catch {
          // Marker can already be detached while MapLibre is tearing down.
        }
      }
      markersRef.current.clear();
    };

    const failBasemap = (message: string) => {
      if (disposed) return;
      if (styleTimer) window.clearTimeout(styleTimer);
      clearMarkers();
      try {
        map?.remove();
      } catch {
        // The constructor can fail after partially creating a map.
      }
      mapRef.current = null;
      setBasemapMessage(message);
      setBasemapStatus("failed");
    };

    setBasemapStatus("loading");
    setBasemapMessage("");
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyleUrl(),
        center: [BKK_CENTER.lng, BKK_CENTER.lat],
        zoom: INITIAL_ZOOM,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
    } catch {
      failBasemap("ไม่สามารถเริ่มระบบแผนที่ได้");
      return;
    }

    const handleLoaded = () => {
      if (disposed || !map || mapRef.current !== map) return;
      if (styleTimer) window.clearTimeout(styleTimer);
      setBasemapMessage("");
      setBasemapStatus("ready");
      map.resize();
    };
    const handleMapError = (event: maplibregl.ErrorEvent) => {
      if (disposed || !map || mapRef.current !== map) return;
      const message =
        event?.error instanceof Error
          ? event.error.message
          : "ทรัพยากรแผนที่บางส่วนโหลดไม่สำเร็จ";
      if (process.env.NODE_ENV === "development") {
        console.warn("[FlowMap] non-fatal map resource error:", message);
      }
      setBasemapMessage("พื้นแผนที่บางส่วนอาจแสดงไม่ครบ");
      setBasemapStatus((status) =>
        status === "ready" || status === "partial" ? "partial" : status,
      );
    };
    const resize = () => {
      if (!map || disposed || mapRef.current !== map) return;
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => map?.resize());
    };

    map.on("load", handleLoaded);
    map.on("style.load", handleLoaded);
    map.on("error", handleMapError);
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(resize);
      observer.observe(containerRef.current);
    }
    resize();

    styleTimer = window.setTimeout(() => {
      if (disposed || !map) return;
      let styleReady = false;
      try {
        styleReady = map.isStyleLoaded() === true;
      } catch {
        styleReady = false;
      }
      if (styleReady) handleLoaded();
      else failBasemap("โหลดรูปแบบพื้นแผนที่ไม่สำเร็จ");
    }, STYLE_LOAD_TIMEOUT_MS);

    return () => {
      disposed = true;
      if (styleTimer) window.clearTimeout(styleTimer);
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      clearMarkers();
      if (map) {
        map.off("load", handleLoaded);
        map.off("style.load", handleLoaded);
        map.off("error", handleMapError);
        try {
          map.remove();
        } catch {
          // Map can already have been removed by a fatal style timeout.
        }
      }
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [mapCanInitialize, mapGeneration]);

  // Geocode only unresolved, named stops. The cache belongs to this component
  // instance and failed entries can be cleared by the Retry action.
  useEffect(() => {
    if (!online) return;
    const unique = new Map<string, string>();
    for (const stop of geocodeCandidates) {
      const key = normalizedLabel(stop.label);
      if (!geoCacheRef.current.has(key)) unique.set(key, stop.label);
    }
    if (unique.size === 0) return;

    let active = true;
    const controllers = new Set<AbortController>();
    for (const key of unique.keys()) {
      geoCacheRef.current.set(key, { status: "loading" });
    }
    setGeoCache(new Map(geoCacheRef.current));

    const lookUp = async ([key, label]: [string, string]) => {
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(label)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`geocode_${response.status}`);
        const data: unknown = await response.json();
        if (!Array.isArray(data)) throw new Error("invalid_geocode_response");
        const hit = data
          .map((candidate) =>
            typeof candidate === "object" && candidate !== null
              ? pointFrom(
                  (candidate as { lat?: unknown }).lat,
                  (candidate as { lng?: unknown }).lng,
                )
              : undefined,
          )
          .find((point): point is Point => Boolean(point));
        if (!active) return;
        if (hit) {
          geoCacheRef.current.set(key, { status: "ready", point: hit });
        } else {
          geoCacheRef.current.set(key, {
            status: "failed",
            reason: data.length === 0 ? "not_found" : "unavailable",
          });
        }
        setGeoCache(new Map(geoCacheRef.current));
      } catch {
        if (!active) {
          geoCacheRef.current.delete(key);
          return;
        }
        geoCacheRef.current.set(key, {
          status: "failed",
          reason: "unavailable",
        });
        setGeoCache(new Map(geoCacheRef.current));
      } finally {
        window.clearTimeout(timeout);
        controllers.delete(controller);
      }
    };

    void Promise.all([...unique.entries()].map(lookUp)).then(() => {
      if (active) setGeoCache(new Map(geoCacheRef.current));
    });

    return () => {
      active = false;
      for (const controller of controllers) controller.abort();
      for (const key of unique.keys()) {
        if (geoCacheRef.current.get(key)?.status === "loading") {
          geoCacheRef.current.delete(key);
        }
      }
    };
  }, [geocodeCandidateKey, geocodeGeneration, online]);

  // Marker lifecycle is independent from map creation and diffed by coordinate.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (basemapStatus !== "ready" && basemapStatus !== "partial")) return;

    const groups = new Map<
      string,
      { point: Point; stops: Array<MapStop & { point: Point }> }
    >();
    for (const stop of located) {
      const key = markerKey(stop.point);
      const group = groups.get(key) ?? { point: stop.point, stops: [] };
      group.stops.push(stop);
      groups.set(key, group);
    }

    for (const [key, record] of markersRef.current) {
      if (groups.has(key)) continue;
      record.marker.remove();
      markersRef.current.delete(key);
    }

    for (const [key, group] of groups) {
      const numberLabel = group.stops.map((stop) => stop.index + 1).join(", ");
      const accessibleLabel = group.stops
        .map((stop) => {
          const time =
            stop.scheduled && stop.start && stop.end
              ? `${stop.start}–${stop.end}`
              : "ยังไม่กำหนดเวลา";
          return `${stop.title} ${time}`;
        })
        .join(", ");
      const existing = markersRef.current.get(key);
      if (existing) {
        existing.element.textContent = numberLabel;
        existing.element.setAttribute("aria-label", accessibleLabel);
        existing.element.onclick = () => setFocus(group.stops[0].index);
        existing.marker.setLngLat([group.point.lng, group.point.lat]);
        continue;
      }

      const element = document.createElement("button");
      element.type = "button";
      element.textContent = numberLabel;
      element.setAttribute("aria-label", accessibleLabel);
      element.dataset.flowMapMarker = key;
      element.style.cssText =
        "min-width:44px;height:44px;padding:0 11px;border:1.5px solid #111;border-radius:22px;background:#111;color:#d6ff3f;display:flex;align-items:center;justify-content:center;font-weight:700;font-family:'Space Grotesk',sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.28);cursor:pointer";
      element.onclick = () => setFocus(group.stops[0].index);
      const marker = new maplibregl.Marker({ element })
        .setLngLat([group.point.lng, group.point.lat])
        .addTo(map);
      markersRef.current.set(key, { marker, element });
    }
  }, [basemapStatus, located, setFocus]);

  const routeKey = routeStops
    .map(
      (stop) =>
        `${stop.taskId}:${stop.point.lat},${stop.point.lng}:${stop.start}-${stop.end}`,
    )
    .join("|");

  // Road routing is intentionally limited to scheduled stops. One marker is a
  // valid map state and must never produce a route request or warning.
  useEffect(() => {
    if (!online || routeStops.length < 2) {
      setRoutingStatus("idle");
      setLegs([]);
      setGeometry([]);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setRoutingStatus("loading");
    setLegs([]);
    setGeometry([]);

    void (async () => {
      try {
        const response = await fetch("/api/route", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode: "route",
            coords: routeStops.map((stop) => stop.point),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`route_${response.status}`);
        const data: unknown = await response.json();
        if (typeof data !== "object" || data === null) {
          throw new Error("invalid_route_response");
        }
        const parsedGeometry = routeGeometry(
          (data as { geometry?: unknown }).geometry,
        );
        const parsedLegs = routeLegs(
          (data as { legs?: unknown }).legs,
          routeStops.length - 1,
        );
        if (
          (data as { fallback?: unknown }).fallback
          || !parsedGeometry
          || !parsedLegs
        ) {
          throw new Error("route_unavailable");
        }
        if (!active) return;
        setGeometry(parsedGeometry);
        setLegs(parsedLegs);
        setRoutingStatus("ready");
      } catch {
        if (!active) return;
        setGeometry([]);
        setLegs([]);
        setRoutingStatus("failed");
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [online, routeKey]);

  // Keep the road source/layer in sync without recreating MapLibre.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (basemapStatus !== "ready" && basemapStatus !== "partial")) return;
    try {
      if (geometry.length < 2) {
        if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
        if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
        return;
      }
      const data = {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "LineString" as const,
          coordinates: geometry,
        },
      };
      const source = map.getSource(ROUTE_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(ROUTE_SOURCE_ID, { type: "geojson", data });
        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: "line",
          source: ROUTE_SOURCE_ID,
          paint: {
            "line-color": "#111111",
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }
    } catch (error) {
      setRoutingStatus("failed");
      if (process.env.NODE_ENV === "development") {
        console.warn("[FlowMap] route layer update failed:", error);
      }
    }
  }, [basemapStatus, geometry]);

  // Viewport changes are based on marker coordinates, not route availability.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (basemapStatus !== "ready" && basemapStatus !== "partial")) return;
    const duration = reducedMotion() ? 0 : 500;
    map.stop();
    if (located.length === 0) {
      map.easeTo({
        center: [BKK_CENTER.lng, BKK_CENTER.lat],
        zoom: INITIAL_ZOOM,
        duration,
      });
      return;
    }
    if (located.length === 1) {
      map.easeTo({
        center: [located[0].point.lng, located[0].point.lat],
        zoom: 14,
        duration,
      });
      return;
    }
    const first = located[0].point;
    const bounds = located
      .slice(1)
      .reduce(
        (value, stop) => value.extend([stop.point.lng, stop.point.lat]),
        new maplibregl.LngLatBounds(
          [first.lng, first.lat],
          [first.lng, first.lat],
        ),
      );
    map.fitBounds(bounds, {
      padding: 48,
      maxZoom: 14,
      duration,
    });
  }, [basemapStatus, located]);

  // Step-through remains available, but unscheduled or unresolved tasks no
  // longer prevent the rest of the map from working.
  useEffect(() => {
    const map = mapRef.current;
    const stop = focus >= 0 ? stops[focus] : undefined;
    if (!map || !stop?.point) return;
    map.stop();
    map.flyTo({
      center: [stop.point.lng, stop.point.lat],
      zoom: 15,
      duration: reducedMotion() ? 0 : 600,
    });
  }, [focus, stops]);

  function retryBasemap() {
    setBasemapStatus("idle");
    setBasemapMessage("");
    setMapGeneration((generation) => generation + 1);
  }

  function retryGeocoding() {
    for (const [label, entry] of geoCacheRef.current) {
      if (entry.status === "failed") geoCacheRef.current.delete(label);
    }
    setGeoCache(new Map(geoCacheRef.current));
    setGeocodeGeneration((generation) => generation + 1);
  }

  function overview() {
    setFocus(-1);
    const map = mapRef.current;
    if (!map) return;
    if (located.length === 0) {
      map.easeTo({
        center: [BKK_CENTER.lng, BKK_CENTER.lat],
        zoom: INITIAL_ZOOM,
        duration: reducedMotion() ? 0 : 500,
      });
      return;
    }
    if (located.length === 1) {
      map.easeTo({
        center: [located[0].point.lng, located[0].point.lat],
        zoom: 14,
        duration: reducedMotion() ? 0 : 500,
      });
      return;
    }
    const first = located[0].point;
    const bounds = located.slice(1).reduce(
      (value, stop) => value.extend([stop.point.lng, stop.point.lat]),
      new maplibregl.LngLatBounds(
        [first.lng, first.lat],
        [first.lng, first.lat],
      ),
    );
    map.fitBounds(bounds, {
      padding: 48,
      maxZoom: 14,
      duration: reducedMotion() ? 0 : 600,
    });
  }

  function next() {
    if (stops.length === 0) return;
    setFocus((current) =>
      current + 1 >= stops.length ? -1 : current + 1,
    );
  }

  const current = focus >= 0 ? stops[focus] : undefined;
  const routeIndexByStop = new Map(
    routeStops.map((stop, index) => [stop.index, index]),
  );
  const currentRouteIndex =
    current === undefined ? undefined : routeIndexByStop.get(current.index);
  const routeExpected =
    currentRouteIndex !== undefined
    && currentRouteIndex > 0;
  const leg =
    routeExpected && currentRouteIndex !== undefined
      ? legs[currentRouteIndex - 1]
      : null;
  const travel = travelLegDisplay(
    leg,
    routeExpected,
    routingStatus === "failed",
  );
  const unresolved = stops.filter((stop) => stop.label && !stop.point);
  const isMapReady =
    basemapStatus === "ready" || basemapStatus === "partial";

  return (
    <section
      aria-label="แผนที่งานของวันนี้"
      className="min-w-0 max-w-full space-y-3 overflow-x-hidden"
    >
      <div className="relative min-h-[300px] w-full overflow-hidden rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-[#eef0ea]">
        <div
          ref={containerRef}
          data-testid="flow-map-canvas"
          className="h-[clamp(300px,48vh,520px)] min-h-[300px] w-full"
          role="region"
          aria-label="แผนที่ตำแหน่งงาน"
        />

        {!online && (
          <MapOverlay
            title="ขณะนี้อุปกรณ์ออฟไลน์"
            description="ยังโหลดพื้นแผนที่และค้นหาเส้นทางไม่ได้ แต่คุณยังดูรายชื่องานและสถานที่ด้านล่างได้"
          />
        )}

        {online && basemapStatus === "loading" && (
          <MapOverlay
            title="กำลังเปิดแผนที่กรุงเทพฯ"
            description="กำลังโหลดพื้นแผนที่ โปรดรอสักครู่"
            busy
          />
        )}

        {online && basemapStatus === "failed" && (
          <MapOverlay
            title="ยังเปิดพื้นแผนที่ไม่ได้"
            description={
              basemapMessage
              || "ตรวจสอบการเชื่อมต่อหรือ URL ของรูปแบบแผนที่ แล้วลองอีกครั้ง"
            }
            action={
              <button
                type="button"
                onClick={retryBasemap}
                className="flow-press min-h-11 rounded-xl bg-[var(--flow-ink)] px-4 py-2 text-sm font-semibold text-white"
              >
                ลองโหลดแผนที่ใหม่
              </button>
            }
          />
        )}

        {online && isMapReady && located.length === 0 && (
          <EmptyMapOverlay
            items={items}
            stops={stops}
            geocodingStatus={geocodingStatus}
            geocodingUnavailable={geocodingUnavailable}
            onAddTask={onAddTask}
            onEditTask={onEditTask}
            onRetry={retryGeocoding}
          />
        )}
      </div>

      {basemapStatus === "partial" && (
        <p
          role="status"
          className="rounded-xl border border-neutral-400 bg-neutral-50 px-3 py-2 text-xs text-neutral-700"
        >
          {basemapMessage || "พื้นแผนที่บางส่วนอาจแสดงไม่ครบ"}
        </p>
      )}

      {routingStatus === "failed" && (
        <p
          role="status"
          className="rounded-xl border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          ยังคำนวณเส้นทางถนนไม่ได้ แต่คุณยังดูตำแหน่งงานได้
        </p>
      )}

      {located.length > 0 && unresolved.length > 0 && geocodingStatus !== "loading" && (
        <div
          role="status"
          className="rounded-xl border border-amber-600 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          <p className="font-semibold">
            {geocodingUnavailable
              ? "บริการค้นหาบางสถานที่ยังไม่พร้อม"
              : "ค้นหาบางสถานที่ไม่พบ"}
          </p>
          <p className="mt-1">
            {geocodingUnavailable
              ? "หมุดที่มีพิกัดอยู่แล้วยังแสดงตามปกติ ลองค้นหาอีกครั้งเมื่อพร้อม"
              : unresolved.map((stop) => stop.label).join(", ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={retryGeocoding}
              className="flow-press min-h-11 rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-white px-3 py-2 font-semibold"
            >
              ลองค้นหาใหม่
            </button>
            {onEditTask && unresolved[0] && (
              <button
                type="button"
                onClick={() => onEditTask(unresolved[0].taskId)}
                className="flow-press min-h-11 rounded-xl bg-[var(--flow-ink)] px-3 py-2 font-semibold text-white"
              >
                แก้ไขงาน
              </button>
            )}
          </div>
        </div>
      )}

      {stops.length > 0 && (
        <div className="space-y-2">
          <div
            className="flex items-center gap-2"
            aria-label="ควบคุมการดูจุดบนแผนที่"
          >
            <button
              type="button"
              onClick={overview}
              className={`flow-press min-h-11 rounded-full border-[1.5px] border-[var(--flow-ink)] px-4 py-2 text-xs font-semibold ${
                focus < 0
                  ? "bg-[var(--flow-ink)] text-[var(--flow-lime)]"
                  : "bg-white"
              }`}
            >
              ภาพรวม
            </button>
            <button
              type="button"
              onClick={next}
              className="flow-press flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--flow-ink)] px-4 py-2 text-xs font-semibold text-white"
            >
              {focus < 0
                ? "เริ่มดูทีละงาน"
                : focus + 1 >= stops.length
                  ? "กลับภาพรวม"
                  : "งานถัดไป"}
              {focus + 1 >= stops.length ? (
                <RotateCcw size={14} className="text-[var(--flow-lime)]" />
              ) : (
                <ArrowRight size={15} className="text-[var(--flow-lime)]" />
              )}
            </button>
          </div>

          {current ? (
            <div className="rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-[#fbffe9] p-3">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    งานที่ <span className="font-grotesk">{focus + 1}</span>{" "}
                    · {current.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-600">
                    <MapPin aria-hidden="true" size={14} />
                    {current.label || "ยังไม่ระบุสถานที่"}
                  </p>
                </div>
                <span className="shrink-0 font-grotesk text-xs text-neutral-600">
                  {current.scheduled && current.start && current.end
                    ? `${current.start}–${current.end}`
                    : "ยังไม่กำหนดเวลา"}
                </span>
              </div>
              {current.index > 0 && routeExpected && (
                <p className="mt-2 text-xs text-neutral-600">
                  {travel.kind === "ready" ? (
                    <>
                      เดินทางจากงานก่อนหน้า ~
                      <span className="font-grotesk">
                        {travel.durationMin}
                      </span>{" "}
                      นาที
                      {travel.distanceKm > 0
                        ? ` · ${travel.distanceKm} กม.`
                        : null}
                    </>
                  ) : travel.kind === "loading" ? (
                    "กำลังคำนวณเวลาเดินทางจากงานก่อนหน้า…"
                  ) : (
                    "ยังคำนวณเวลาเดินทางจากงานก่อนหน้าไม่ได้"
                  )}
                </p>
              )}
              {!current.point && current.label && (
                <p className="mt-2 text-xs text-amber-700">
                  ยังหาพิกัดของ “{current.label}” ไม่พบ
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs leading-5 text-neutral-600">
              ทั้งหมด <span className="font-grotesk">{stops.length}</span> งาน
              · มีตำแหน่งแล้ว{" "}
              <span className="font-grotesk">{located.length}</span> งาน
            </p>
          )}
        </div>
      )}

      {(basemapStatus === "failed" || !online) && stops.length > 0 && (
        <PlaceFallbackList stops={stops} onEditTask={onEditTask} />
      )}
    </section>
  );
}

function MapOverlay({
  title,
  description,
  action,
  busy = false,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  busy?: boolean;
}) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-white/86 p-4 backdrop-blur-[2px]">
      <div
        role={busy ? "status" : "group"}
        aria-live={busy ? "polite" : undefined}
        className="w-full max-w-sm rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-white p-4 shadow-lg"
      >
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-6 text-[var(--flow-muted)]">
          {description}
        </p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

function EmptyMapOverlay({
  items,
  stops,
  geocodingStatus,
  geocodingUnavailable,
  onAddTask,
  onEditTask,
  onRetry,
}: {
  items: MapTaskItem[];
  stops: MapStop[];
  geocodingStatus: GeocodingStatus;
  geocodingUnavailable: boolean;
  onAddTask?: () => void;
  onEditTask?: (taskId: string) => void;
  onRetry: () => void;
}) {
  const hasNamedPlace = stops.some((stop) => stop.label);
  const firstEditable = hasNamedPlace
    ? stops.find((stop) => stop.label)
    : stops[0];

  if (items.length === 0) {
    return (
      <MapOverlay
        title="ยังไม่มีงานสำหรับแสดงบนแผนที่"
        description="เพิ่มงานพร้อมสถานที่ แล้วตำแหน่งจะปรากฏที่นี่"
        action={
          onAddTask ? (
            <button
              type="button"
              onClick={onAddTask}
              className="flow-press min-h-11 rounded-xl bg-[var(--flow-ink)] px-4 py-2 text-sm font-semibold text-white"
            >
              เพิ่มงาน
            </button>
          ) : undefined
        }
      />
    );
  }

  if (!hasNamedPlace) {
    return (
      <MapOverlay
        title="งานวันนี้ยังไม่ได้ระบุสถานที่"
        description="แก้ไขงานและเลือกสถานที่เพื่อแสดงหมุดบนแผนที่"
        action={
          onEditTask && firstEditable ? (
            <button
              type="button"
              onClick={() => onEditTask(firstEditable.taskId)}
              className="flow-press min-h-11 rounded-xl bg-[var(--flow-ink)] px-4 py-2 text-sm font-semibold text-white"
            >
              แก้ไขงาน
            </button>
          ) : undefined
        }
      />
    );
  }

  if (geocodingStatus === "loading") {
    return (
      <MapOverlay
        title="กำลังค้นหาตำแหน่ง"
        description="ระบบกำลังแปลงชื่อสถานที่เป็นพิกัดบนแผนที่"
        busy
      />
    );
  }

  return (
    <MapOverlay
      title={
        geocodingUnavailable
          ? "ยังใช้บริการค้นหาตำแหน่งไม่ได้"
          : "ค้นหาบางสถานที่ไม่พบ"
      }
      description={
        geocodingUnavailable
          ? "พื้นแผนที่ยังใช้งานได้ ลองค้นหาอีกครั้งเมื่อการเชื่อมต่อบริการกลับมาพร้อม"
          : "แก้ไขงานแล้วเลือกสถานที่จากผลการค้นหา หรือปักหมุดด้วยตนเอง"
      }
      action={
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flow-press min-h-11 rounded-xl border-[1.5px] border-[var(--flow-ink)] bg-white px-3 py-2 text-sm font-semibold"
          >
            ลองค้นหาใหม่
          </button>
          {onEditTask && firstEditable && (
            <button
              type="button"
              onClick={() => onEditTask(firstEditable.taskId)}
              className="flow-press min-h-11 rounded-xl bg-[var(--flow-ink)] px-3 py-2 text-sm font-semibold text-white"
            >
              แก้ไขงาน
            </button>
          )}
        </div>
      }
    />
  );
}

function PlaceFallbackList({
  stops,
  onEditTask,
}: {
  stops: MapStop[];
  onEditTask?: (taskId: string) => void;
}) {
  return (
    <div className="rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-white p-4">
      <p className="text-sm font-semibold">งานและสถานที่ของวันนี้</p>
      <ol className="mt-3 space-y-2">
        {stops.map((stop) => (
          <li
            key={stop.taskId}
            className="flex min-w-0 items-center justify-between gap-3 text-sm"
          >
            <span className="min-w-0 truncate">
              <span className="font-grotesk">{stop.index + 1}.</span>{" "}
              {stop.title} · {stop.label || "ยังไม่ระบุสถานที่"}
            </span>
            {onEditTask && (
              <button
                type="button"
                onClick={() => onEditTask(stop.taskId)}
                className="flow-press min-h-11 shrink-0 rounded-xl border border-[var(--flow-ink)] px-3 py-2 text-xs font-semibold"
              >
                แก้ไข
              </button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
