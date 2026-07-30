"use client";
import { useEffect } from "react";
import { isNativeRuntime, safeStartupError } from "@/lib/native-runtime";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function configureServiceWorker() {
      if (isNativeRuntime()) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister()),
        );
        if ("caches" in window) {
          const names = await caches.keys();
          await Promise.all(
            names
              .filter((name) => name.startsWith("flow-shell-"))
              .map((name) => caches.delete(name)),
          );
        }
        return;
      }
      await navigator.serviceWorker.register("/sw.js");
    }

    void configureServiceWorker().catch((error) => {
      if (process.env.NEXT_PUBLIC_FLOW_DEBUG_STARTUP === "1") {
        console.error("[Flow startup]", {
          subsystem: "service-worker",
          stage: "registration",
          ...safeStartupError(error),
        });
      }
    });
  }, []);
  return null;
}
