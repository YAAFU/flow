"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CoordinatesSchema,
  CurrentLocationSchema,
  type CurrentLocation,
} from "@/lib/location";

export type CurrentLocationStatus =
  | "idle"
  | "loading"
  | "success"
  | "denied"
  | "unsupported"
  | "inaccurate"
  | "timeout"
  | "error"
  | "reverse-error";

export type CurrentLocationState = {
  status: CurrentLocationStatus;
  location: CurrentLocation | null;
  /** Reverse geocoding is optional; coordinates remain usable when it fails. */
  reverseGeocodeFailed: boolean;
};

export type UseCurrentLocationOptions = {
  accuracyThresholdM?: number;
  timeoutMs?: number;
  maximumAgeMs?: number;
  reverseGeocodeEndpoint?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
};

export type UseCurrentLocationResult = CurrentLocationState & {
  isLoading: boolean;
  request: () => void;
  reset: () => void;
};

const INITIAL_STATE: CurrentLocationState = { status: "idle", location: null, reverseGeocodeFailed: false };
const DEFAULT_ACCURACY_THRESHOLD_M = 250;

function geolocationFailureStatus(error: GeolocationPositionError): CurrentLocationStatus {
  if (error.code === error.PERMISSION_DENIED || error.code === 1) return "denied";
  if (error.code === error.TIMEOUT || error.code === 3) return "timeout";
  return "error";
}

function validAccuracy(value: number): number | undefined {
  return Number.isFinite(value) && value >= 0 ? Math.min(100_000, value) : undefined;
}

function capturedAt(position: GeolocationPosition, now: () => Date): string {
  const timestamp = Number.isFinite(position.timestamp) && position.timestamp > 0
    ? position.timestamp
    : now().getTime();
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : now().toISOString();
}

export function useCurrentLocation(options: UseCurrentLocationOptions = {}): UseCurrentLocationResult {
  const accuracyThresholdM = options.accuracyThresholdM ?? DEFAULT_ACCURACY_THRESHOLD_M;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const maximumAgeMs = options.maximumAgeMs ?? 60_000;
  const reverseGeocodeEndpoint = options.reverseGeocodeEndpoint ?? "/api/geocode";
  const fetcher = options.fetcher;
  const now = options.now;
  const [state, setState] = useState<CurrentLocationState>(INITIAL_STATE);
  const mountedRef = useRef(false);
  const operationRef = useRef(0);
  const reverseAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      operationRef.current += 1;
      reverseAbortRef.current?.abort();
      reverseAbortRef.current = null;
    };
  }, []);

  const reset = useCallback(() => {
    operationRef.current += 1;
    reverseAbortRef.current?.abort();
    reverseAbortRef.current = null;
    if (mountedRef.current) setState(INITIAL_STATE);
  }, []);

  const request = useCallback(() => {
    const operation = ++operationRef.current;
    reverseAbortRef.current?.abort();
    reverseAbortRef.current = null;

    const geolocation = typeof navigator === "undefined" ? undefined : navigator.geolocation;
    if (!geolocation) {
      if (mountedRef.current) setState({ status: "unsupported", location: null, reverseGeocodeFailed: false });
      return;
    }

    setState({ status: "loading", location: null, reverseGeocodeFailed: false });
    const isCurrent = () => mountedRef.current && operationRef.current === operation;

    try {
      geolocation.getCurrentPosition(async (position) => {
        if (!isCurrent()) return;
        const coordinates = CoordinatesSchema.safeParse({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (!coordinates.success) {
          setState({ status: "error", location: null, reverseGeocodeFailed: false });
          return;
        }

        const accuracy = validAccuracy(position.coords.accuracy);
        const location = CurrentLocationSchema.parse({
          ...coordinates.data,
          accuracy,
          placeName: "ตำแหน่งปัจจุบัน",
          capturedAt: capturedAt(position, now ?? (() => new Date())),
          source: "live",
        });
        const resolvedStatus: CurrentLocationStatus = accuracy != null && accuracy > accuracyThresholdM
          ? "inaccurate"
          : "success";
        setState({ status: resolvedStatus, location, reverseGeocodeFailed: false });

        const controller = new AbortController();
        reverseAbortRef.current = controller;
        try {
          const requestFetch = fetcher ?? globalThis.fetch;
          if (typeof requestFetch !== "function") throw new Error("fetch_unsupported");
          const response = await requestFetch(reverseGeocodeEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: location.latitude, longitude: location.longitude }),
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("reverse_geocode_failed");
          const data: unknown = await response.json();
          const placeName = typeof data === "object" && data !== null && typeof (data as { name?: unknown }).name === "string"
            ? (data as { name: string }).name.trim()
            : "";
          // The current API uses this generic value when Nominatim is down.
          if (!placeName || placeName === "หมุดที่ปัก") throw new Error("reverse_geocode_unresolved");
          if (!isCurrent()) return;
          setState({
            status: resolvedStatus,
            location: CurrentLocationSchema.parse({ ...location, placeName }),
            reverseGeocodeFailed: false,
          });
        } catch (error) {
          if ((error as { name?: string }).name === "AbortError" || !isCurrent()) return;
          // Keep the accuracy state: low accuracy and reverse-geocode failure
          // are independent facts, and neither makes the coordinates unusable.
          setState({ status: resolvedStatus, location, reverseGeocodeFailed: true });
        } finally {
          if (reverseAbortRef.current === controller) reverseAbortRef.current = null;
        }
      }, (error) => {
        if (!isCurrent()) return;
        setState({ status: geolocationFailureStatus(error), location: null, reverseGeocodeFailed: false });
      }, {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: maximumAgeMs,
      });
    } catch {
      if (isCurrent()) setState({ status: "error", location: null, reverseGeocodeFailed: false });
    }
  }, [accuracyThresholdM, fetcher, maximumAgeMs, now, reverseGeocodeEndpoint, timeoutMs]);

  return {
    ...state,
    isLoading: state.status === "loading",
    request,
    reset,
  };
}
