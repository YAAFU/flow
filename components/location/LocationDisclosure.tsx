"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, BriefcaseBusiness, Check, ChevronDown, Clock3, Dumbbell, GraduationCap, Home, Loader2, MapPin, Pencil, Plus, Search, Sparkles, Star, Trash2, X } from "lucide-react";
import { LocationPicker } from "@/components/LocationPicker";
import { useCurrentLocation, type CurrentLocationStatus } from "@/hooks/useCurrentLocation";
import {
  CoordinatesSchema,
  currentLocationToTaskLocation,
  hasCoordinates,
  type TaskLocation,
} from "@/lib/location";
import { recentPlaceToLocation, savedPlaceToLocation, type PlaceSuggestion } from "@/lib/smart-places";
import type { RecentPlace, SavedPlace } from "@/lib/types";

type SearchState = "idle" | "loading" | "success" | "empty" | "error";

export type LocationDisclosureProps = {
  value: TaskLocation | null;
  onChange: (location: TaskLocation | null) => void;
  title?: string;
  description?: string;
  defaultExpanded?: boolean;
  disabled?: boolean;
  quickLocations?: readonly TaskLocation[];
  savedPlaces?: readonly SavedPlace[];
  recentPlaces?: readonly RecentPlace[];
  suggestions?: readonly PlaceSuggestion[];
  recommendationsEnabled?: boolean;
  onAddSavedPlace?: () => void;
  onEditSavedPlace?: (place: SavedPlace) => void;
  onPromoteRecentPlace?: (place: RecentPlace) => void;
  onClearRecent?: () => void;
  onBusyChange?: (busy: boolean) => void;
};

function SavedPlaceIcon({ place }: { place: SavedPlace }) {
  const props = { size: 15, "aria-hidden": true as const };
  if (place.category === "home") return <Home {...props} />;
  if (place.category === "school" || place.category === "university") return <GraduationCap {...props} />;
  if (place.category === "work") return <BriefcaseBusiness {...props} />;
  if (place.category === "fitness") return <Dumbbell {...props} />;
  return <Star {...props} />;
}

function liveStatusMessage(status: CurrentLocationStatus, accuracy?: number, reverseGeocodeFailed = false): string {
  switch (status) {
    case "loading": return "กำลังค้นหาตำแหน่งปัจจุบัน…";
    case "success": return reverseGeocodeFailed
      ? "พบตำแหน่งปัจจุบันแล้ว แต่ยังหาชื่อสถานที่ไม่ได้ ระบบจะใช้พิกัดที่พบ"
      : "พบตำแหน่งปัจจุบันแล้ว";
    case "denied": return "ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง คุณยังเลือกสถานที่เองหรือไม่ระบุตำแหน่งได้";
    case "unsupported": return "เบราว์เซอร์นี้ไม่รองรับตำแหน่ง คุณยังเลือกสถานที่เองหรือไม่ระบุตำแหน่งได้";
    case "inaccurate": return `พบตำแหน่งแล้ว แต่ความแม่นยำค่อนข้างต่ำ${accuracy != null ? ` (ประมาณ ±${Math.round(accuracy)} เมตร)` : ""}${reverseGeocodeFailed ? " และยังหาชื่อสถานที่ไม่ได้ ระบบจะใช้พิกัดที่พบ" : ""}`;
    case "timeout": return "ค้นหาตำแหน่งไม่ทันเวลา กรุณาลองอีกครั้งหรือเลือกสถานที่เอง";
    case "reverse-error": return "พบตำแหน่งปัจจุบันแล้ว แต่ยังหาชื่อสถานที่ไม่ได้ ระบบจะใช้พิกัดที่พบ";
    case "error": return "ค้นหาตำแหน่งไม่ได้ในขณะนี้ คุณยังเลือกสถานที่เองหรือไม่ระบุตำแหน่งได้";
    default: return "";
  }
}

function isErrorStatus(status: CurrentLocationStatus) {
  return status === "denied" || status === "unsupported" || status === "timeout" || status === "error";
}

function isSameLocation(left: TaskLocation | null, right: TaskLocation) {
  return left?.name === right.name
    && left.latitude === right.latitude
    && left.longitude === right.longitude
    && left.source === right.source;
}

function capturedTimeLabel(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LocationDisclosure({
  value,
  onChange,
  title = "ที่ไหน",
  description = "ใช้ตำแหน่งเพื่อช่วยคำนวณการเดินทางและจัดลำดับงาน โดยจะขอสิทธิ์เมื่อคุณกดใช้ตำแหน่งปัจจุบันเท่านั้น",
  defaultExpanded = false,
  disabled = false,
  quickLocations = [],
  savedPlaces = [],
  recentPlaces = [],
  suggestions = [],
  recommendationsEnabled = true,
  onAddSavedPlace,
  onEditSavedPlace,
  onPromoteRecentPlace,
  onClearRecent,
  onBusyChange,
}: LocationDisclosureProps) {
  const disclosureId = useId();
  const descriptionId = useId();
  const searchId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TaskLocation[]>([]);
  const [searchState, setSearchState] = useState<SearchState>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const searchAbortRef = useRef<AbortController | null>(null);
  const disclosureButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const emittedLiveRef = useRef("");
  const onBusyChangeRef = useRef(onBusyChange);
  const live = useCurrentLocation();

  useEffect(() => {
    onBusyChangeRef.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    onBusyChangeRef.current?.(live.isLoading);
  }, [live.isLoading, live.status]);

  useEffect(() => () => {
    onBusyChangeRef.current?.(false);
  }, []);

  useEffect(() => {
    searchAbortRef.current?.abort();
    const search = query.trim();
    if (search.length < 2) return;

    const controller = new AbortController();
    searchAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("geocode_failed");
        const data: unknown = await response.json();
        const safeHits = Array.isArray(data) ? data.flatMap((item): TaskLocation[] => {
          if (typeof item !== "object" || item === null) return [];
          const candidate = item as { name?: unknown; lat?: unknown; lng?: unknown };
          const coordinates = CoordinatesSchema.safeParse({ latitude: candidate.lat, longitude: candidate.lng });
          if (typeof candidate.name !== "string" || !candidate.name.trim() || !coordinates.success) return [];
          return [{ name: candidate.name.trim(), ...coordinates.data, source: "search" }];
        }) : [];
        setHits(safeHits);
        setSearchState(safeHits.length ? "success" : "empty");
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setHits([]);
        setSearchState("error");
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    if (focusFrameRef.current != null) window.cancelAnimationFrame(focusFrameRef.current);
  }, []);

  useEffect(() => {
    if (!live.location) return;
    const next = currentLocationToTaskLocation(live.location);
    const emissionKey = JSON.stringify(next);
    if (emittedLiveRef.current === emissionKey) return;
    emittedLiveRef.current = emissionKey;
    setSelectionAnnouncement(`เลือกสถานที่ ${next.name} แล้ว`);
    onChange(next);
  }, [live.location, onChange]);

  const focusAfterSelection = () => {
    if (focusFrameRef.current != null) window.cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      (searchInputRef.current ?? disclosureButtonRef.current)?.focus();
    });
  };

  const select = (location: TaskLocation) => {
    live.reset();
    emittedLiveRef.current = "";
    setQuery("");
    setHits([]);
    setSearchState("idle");
    setSelectionAnnouncement(`เลือกสถานที่ ${location.name} แล้ว`);
    onChange(location);
    focusAfterSelection();
  };

  const clear = () => {
    live.reset();
    emittedLiveRef.current = "";
    setQuery("");
    setHits([]);
    setSearchState("idle");
    setSelectionAnnouncement("ล้างสถานที่แล้ว");
    onChange(null);
    focusAfterSelection();
  };

  const statusMessage = liveStatusMessage(live.status, live.location?.accuracy, live.reverseGeocodeFailed);
  const showPersonalSections = query.trim().length < 2;
  const frequentSaveCandidate = onPromoteRecentPlace
    ? recentPlaces.find((recent) => recent.useCount >= 3 && !savedPlaces.some((saved) => {
      const recentName = recent.placeName.trim().toLocaleLowerCase("th-TH");
      return saved.label.trim().toLocaleLowerCase("th-TH") === recentName
        || saved.placeName.trim().toLocaleLowerCase("th-TH") === recentName;
    }))
    : undefined;

  return (
    <div className="rounded-xl bg-[var(--flow-surface)]">
      <button
        ref={disclosureButtonRef}
        type="button"
        aria-expanded={expanded}
        aria-controls={disclosureId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-50"
      >
        <span className="flex min-w-0 items-center gap-2 text-left">
          <MapPin aria-hidden size={16} className={hasCoordinates(value) ? "shrink-0 text-[var(--flow-ink)]" : "shrink-0 text-[var(--flow-muted)]"} />
          <span className="font-medium">{title}</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-right text-xs text-[var(--flow-muted)]">
          <span className="truncate">{value?.name || "ยังไม่ระบุ"}</span>
          <ChevronDown aria-hidden size={14} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      <p id={descriptionId} className="sr-only">{description}</p>
      {expanded && (
        <div id={disclosureId} className="flow-expand flex flex-col gap-2 px-3 pb-3">
          <p className="text-xs leading-5 text-[var(--flow-muted)]">{description}</p>
          {value?.source === "live" && value.capturedAt && <p className="text-xs text-[var(--flow-muted)]">อัปเดตตำแหน่งล่าสุด <span className="font-grotesk">{capturedTimeLabel(value.capturedAt)}</span> น.</p>}

          <div className="relative">
            <Search aria-hidden size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--flow-muted)]" />
            <label htmlFor={searchId} className="sr-only">ค้นหาสถานที่</label>
            <input
              ref={searchInputRef}
              id={searchId}
              value={query}
              disabled={disabled}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setHits([]);
                setSearchState(nextQuery.trim().length >= 2 ? "loading" : "idle");
              }}
              placeholder="ค้นหาสถานที่"
              autoComplete="off"
              className="h-11 w-full rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)] pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime)] disabled:opacity-50"
            />
          </div>

          {query.trim().length >= 2 && searchState !== "idle" && (
            <div role="status" aria-live="polite" aria-busy={searchState === "loading"} className="overflow-hidden rounded-xl border border-[var(--flow-line)] bg-[var(--flow-paper)]">
              {searchState === "loading" && <p className="flex min-h-11 items-center gap-2 px-3 text-xs text-[var(--flow-muted)]"><Loader2 aria-hidden size={14} className="animate-spin" />กำลังค้นหา…</p>}
              {searchState === "empty" && <p className="px-3 py-3 text-xs text-[var(--flow-muted)]">ไม่พบสถานที่ ลองใช้คำค้นอื่นหรือข้ามส่วนนี้ได้</p>}
              {searchState === "error" && <p className="flex items-start gap-2 px-3 py-3 text-xs text-[var(--flow-warning)]"><AlertCircle aria-hidden size={14} className="mt-0.5 shrink-0" />ค้นหาสถานที่ไม่ได้ในขณะนี้ คุณยังใช้งานต่อโดยไม่ระบุตำแหน่งได้</p>}
              {searchState === "success" && hits.map((hit) => (
                <button
                  type="button"
                  key={`${hit.latitude}-${hit.longitude}-${hit.name}`}
                  onClick={() => select(hit)}
                  className="flex min-h-11 w-full items-center gap-2 border-b border-[var(--flow-line)] px-3 py-2 text-left text-xs last:border-b-0 hover:bg-[var(--flow-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--flow-lime-dark)]"
                >
                  <MapPin aria-hidden size={14} className="shrink-0 text-[var(--flow-muted)]" />
                  <span className="line-clamp-2">{hit.name}</span>
                </button>
              ))}
            </div>
          )}

          {showPersonalSections && savedPlaces.length > 0 && <section aria-labelledby={`${disclosureId}-saved`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 id={`${disclosureId}-saved`} className="flex items-center gap-1.5 text-xs font-semibold"><Star aria-hidden size={14} />สถานที่ประจำ</h3>
              {onAddSavedPlace && <button type="button" onClick={onAddSavedPlace} className="min-h-9 px-2 text-xs font-semibold underline decoration-[var(--flow-lime-dark)] decoration-2 underline-offset-4"><Plus aria-hidden size={12} className="mr-1 inline" />เพิ่ม</button>}
            </div>
            <div className="space-y-1">
              {savedPlaces.map((place) => {
                const location = savedPlaceToLocation(place);
                const selected = isSameLocation(value, location);
                return <div key={place.id} className={`flex min-h-12 items-center rounded-xl border ${selected ? "border-[var(--flow-ink)] bg-[var(--flow-surface)]" : "border-[var(--flow-line)]"}`}>
                  <button type="button" aria-pressed={selected} disabled={disabled} onClick={() => select(location)} className="flex min-w-0 flex-1 items-center gap-2 self-stretch px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-50">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--flow-surface)]"><SavedPlaceIcon place={place} /></span>
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold">{place.label}</span>{place.placeName !== place.label && <span className="block truncate text-[11px] text-[var(--flow-muted)]">{place.placeName}</span>}</span>
                    {selected && <Check aria-hidden size={14} className="ml-auto shrink-0" />}
                  </button>
                  {onEditSavedPlace && <button type="button" aria-label={`แก้ไขสถานที่ประจำ ${place.label}`} onClick={() => onEditSavedPlace(place)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"><Pencil aria-hidden size={14} /></button>}
                </div>;
              })}
            </div>
          </section>}

          {showPersonalSections && savedPlaces.length === 0 && onAddSavedPlace && <button type="button" onClick={onAddSavedPlace} className="flow-press flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--flow-line)] text-xs font-semibold"><Plus aria-hidden size={14} />เพิ่มสถานที่ประจำ</button>}
          {showPersonalSections && savedPlaces.length === 0 && !onAddSavedPlace && <p className="rounded-xl border border-dashed border-[var(--flow-line)] px-3 py-2 text-xs text-[var(--flow-muted)]">เพิ่มสถานที่ประจำได้จากเมนู ตั้งค่า → สถานที่และการเดินทาง</p>}

          {showPersonalSections && recommendationsEnabled && suggestions.length > 0 && <section aria-labelledby={`${disclosureId}-suggested`}>
            <h3 id={`${disclosureId}-suggested`} className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><Sparkles aria-hidden size={14} />แนะนำสำหรับคุณ</h3>
            <div className="space-y-1">
              {suggestions.map((suggestion) => <button type="button" key={suggestion.key} onClick={() => select(suggestion.location)} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--flow-line)] px-3 py-2 text-left">
                <Sparkles aria-hidden size={14} className="shrink-0 text-[var(--flow-lime-dark)]" />
                <span className="min-w-0"><span className="block truncate text-xs font-semibold">{suggestion.location.name}</span><span className="block truncate text-[11px] text-[var(--flow-muted)]">{suggestion.reason}</span></span>
              </button>)}
            </div>
          </section>}

          {showPersonalSections && recentPlaces.length > 0 && <section aria-labelledby={`${disclosureId}-recent`}>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 id={`${disclosureId}-recent`} className="flex items-center gap-1.5 text-xs font-semibold"><Clock3 aria-hidden size={14} />ล่าสุด</h3>
              {onClearRecent && <button type="button" onClick={onClearRecent} className="min-h-9 px-2 text-xs text-[var(--flow-muted)]"><Trash2 aria-hidden size={12} className="mr-1 inline" />ล้าง</button>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentPlaces.slice(0, 5).map((place) => <button type="button" key={place.placeKey} onClick={() => select(recentPlaceToLocation(place))} className="flex min-h-9 max-w-full items-center gap-1 rounded-full border border-[var(--flow-line)] px-3 text-xs"><Clock3 aria-hidden size={12} /><span className="truncate">{place.placeName}</span></button>)}
            </div>
          </section>}

          {showPersonalSections && frequentSaveCandidate && <aside className="rounded-xl border border-[var(--flow-line)] bg-[var(--flow-surface)] p-3">
            <p className="text-xs font-semibold">คุณใช้ {frequentSaveCandidate.placeName} บ่อย ต้องการบันทึกเป็นสถานที่ประจำไหม?</p>
            <button type="button" onClick={() => onPromoteRecentPlace?.(frequentSaveCandidate)} className="mt-2 min-h-10 rounded-xl border border-[var(--flow-line)] px-3 text-xs font-semibold"><Star aria-hidden size={13} className="mr-1 inline" />บันทึกเป็นสถานที่ประจำ</button>
          </aside>}

          {showPersonalSections && quickLocations.length > 0 && <div role="group" className="flex flex-wrap gap-1.5" aria-label="สถานที่ด่วน">
            {quickLocations.map((location) => {
              const selected = isSameLocation(value, location);
              return (
                <button
                  type="button"
                  aria-pressed={selected}
                  disabled={disabled}
                  key={`${location.name}-${location.latitude ?? "name"}-${location.longitude ?? "only"}`}
                  onClick={() => select(location)}
                  className={`flex min-h-9 items-center gap-1 rounded-full border px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--flow-lime-dark)] disabled:opacity-50 ${selected ? "flow-inverse border-[var(--flow-inverse)]" : "border-[var(--flow-line)] text-[var(--flow-muted)]"}`}
                >
                  {selected && <Check aria-hidden size={12} />}{location.name}
                </button>
              );
            })}
          </div>}

          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || live.isLoading} onClick={() => { onBusyChangeRef.current?.(true); live.request(); }} className="flow-press min-h-10 rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 text-xs font-semibold disabled:opacity-50">
              {live.isLoading ? <Loader2 aria-hidden size={13} className="mr-1 inline animate-spin" /> : <MapPin aria-hidden size={13} className="mr-1 inline" />}
              {live.isLoading ? "กำลังค้นหาตำแหน่ง" : "ใช้ตำแหน่งปัจจุบัน"}
            </button>
            <button type="button" disabled={disabled} onClick={() => setPickerOpen(true)} className="flow-press min-h-10 rounded-full border-[1.5px] border-[var(--flow-ink)] px-3 text-xs font-semibold disabled:opacity-50"><MapPin aria-hidden size={13} className="mr-1 inline" />ปักหมุดบนแผนที่</button>
            {value && <button type="button" aria-label="ล้างสถานที่" disabled={disabled} onClick={clear} className="flow-press min-h-10 rounded-full border border-[var(--flow-line)] px-3 text-xs disabled:opacity-50"><X aria-hidden size={13} className="mr-1 inline" />ไม่ระบุตำแหน่ง</button>}
          </div>

          {statusMessage && (
            <p role={isErrorStatus(live.status) ? "alert" : "status"} aria-live="polite" className={`min-h-5 text-xs leading-5 ${isErrorStatus(live.status) ? "text-[var(--flow-warning)]" : "text-[var(--flow-muted)]"}`}>
              {statusMessage}
            </p>
          )}
          <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{selectionAnnouncement}</p>
        </div>
      )}

      <LocationPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initial={hasCoordinates(value) ? { lat: value.latitude, lng: value.longitude } : undefined}
        onPick={(location) => {
          select({ name: location.name, latitude: location.lat, longitude: location.lng, source: "map" });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
