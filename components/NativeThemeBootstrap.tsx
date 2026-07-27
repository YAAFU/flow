"use client";

import { useEffect } from "react";

export function NativeThemeBootstrap() {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("flow_state_v2");
      const saved = raw ? JSON.parse(raw)?.settings?.theme : "system";
      const dark =
        saved === "dark"
        || (
          saved !== "light"
          && window.matchMedia("(prefers-color-scheme: dark)").matches
        );
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    } catch {
      document.documentElement.dataset.theme = "light";
    }
  }, []);

  return null;
}
