"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  canPersistOnboardingState,
  loadOnboardingState,
  onboardingEntryPath,
} from "@/lib/onboarding";
import type { StorageLike } from "@/lib/storage";

export interface OnboardingGateProps {
  children: ReactNode;
  /**
   * Injectable only for deterministic tests. Production always uses the
   * browser's localStorage.
   */
  storage?: StorageLike;
}

export function OnboardingGate({ children, storage }: OnboardingGateProps) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const onboardingStorage = storage ?? window.localStorage;

    // Guidance must never trap someone whose browser blocks persistence.
    if (!canPersistOnboardingState(onboardingStorage)) {
      const timer = window.setTimeout(() => setAllowed(true), 0);
      return () => window.clearTimeout(timer);
    }

    const destination = onboardingEntryPath(
      loadOnboardingState(onboardingStorage),
    );
    if (destination === "/guide") {
      router.replace("/guide");
      return;
    }

    const timer = window.setTimeout(() => setAllowed(true), 0);
    return () => window.clearTimeout(timer);
  }, [router, storage]);

  if (!allowed) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-dvh place-items-center bg-[var(--flow-paper)] px-4 text-[var(--flow-ink)]"
      >
        <p role="status" className="text-sm text-[var(--flow-muted)]">
          กำลังเตรียม Flow…
        </p>
      </main>
    );
  }

  return children;
}
