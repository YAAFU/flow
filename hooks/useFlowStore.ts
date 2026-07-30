"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getFlowState, getServerFlowState, getServerHydrated, hydrateFlow, isFlowHydrated, subscribeFlow, updateFlow } from "@/lib/flow-store";

export function useFlowStore() {
  const state = useSyncExternalStore(subscribeFlow, getFlowState, getServerFlowState);
  const hydrated = useSyncExternalStore(subscribeFlow, isFlowHydrated, getServerHydrated);
  useEffect(() => { hydrateFlow(); }, []);
  return { state, hydrated, updateFlow };
}
