"use client";

import { createDefaultState, loadState, saveState } from "@/lib/storage";
import type { FlowState } from "@/lib/types";

let state = createDefaultState(new Date("2026-01-01T00:00:00.000Z"));
let hydrated = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((listener) => listener()); }

export function getFlowState(): FlowState { return state; }
export function getServerFlowState(): FlowState { return state; }
export function subscribeFlow(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateFlow(): void {
  if (hydrated || typeof window === "undefined") return;
  state = loadState(window.localStorage);
  hydrated = true;
  emit();
}

export function updateFlow(updater: (previous: FlowState) => FlowState): void {
  state = updater(state);
  if (typeof window !== "undefined") state = saveState(window.localStorage, state);
  emit();
}

export function replaceFlow(next: FlowState): void {
  state = next;
  if (typeof window !== "undefined") state = saveState(window.localStorage, state);
  emit();
}
