"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getFlowState, getServerFlowState, hydrateFlow, subscribeFlow, updateFlow } from "@/lib/flow-store";

export function useFlowStore() {
  const state = useSyncExternalStore(subscribeFlow, getFlowState, getServerFlowState);
  useEffect(() => { hydrateFlow(); }, []);
  return { state, updateFlow };
}
