"use client";

import {
  Component,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { safeStartupError } from "@/lib/native-runtime";

type Props = { children: ReactNode };
type State = { error: Error | null; clearing: boolean };

async function clearStartupCaches(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ("caches" in window) {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith("flow-shell-"))
        .map((name) => caches.delete(name)),
    );
  }
}

export class StartupErrorBoundary extends Component<Props, State> {
  state: State = { error: null, clearing: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, clearing: false };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NEXT_PUBLIC_FLOW_DEBUG_STARTUP === "1") {
      const safe = safeStartupError(error);
      console.error("[Flow startup]", {
        subsystem: "react",
        stage: "render",
        type: safe.type,
        message: safe.message,
        componentStack: info.componentStack?.slice(0, 600),
      });
    }
  }

  private retry = () => {
    window.location.reload();
  };

  private clearAndRetry = async () => {
    if (this.state.clearing) return;
    this.setState({ clearing: true });
    try {
      await clearStartupCaches();
      window.location.reload();
    } catch (error) {
      if (process.env.NEXT_PUBLIC_FLOW_DEBUG_STARTUP === "1") {
        console.error("[Flow startup]", {
          subsystem: "cache",
          stage: "recovery",
          ...safeStartupError(error),
        });
      }
      this.setState({ clearing: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const debug =
      process.env.NEXT_PUBLIC_FLOW_DEBUG_STARTUP === "1"
        ? safeStartupError(this.state.error)
        : null;

    return (
      <main className="grid min-h-dvh place-items-center bg-[var(--flow-paper)] p-4 text-[var(--flow-ink)]">
        <section
          aria-labelledby="startup-error-title"
          className="w-full max-w-sm rounded-3xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-surface-card)] p-6 shadow-[var(--flow-shadow)]"
        >
          <p className="font-grotesk text-xs font-bold tracking-[0.14em] text-[var(--flow-lime-dark)]">
            FLOW STARTUP
          </p>
          <h1 id="startup-error-title" className="mt-2 text-2xl font-bold">
            เปิด Flow ไม่สำเร็จ
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--flow-text-secondary)]">
            แอปพบปัญหาระหว่างเตรียมข้อมูล กรุณาลองเปิดใหม่
          </p>
          <div className="mt-6 grid gap-2">
            <button
              type="button"
              onClick={this.retry}
              className="min-h-12 rounded-2xl bg-[var(--flow-inverse)] px-4 font-semibold text-[var(--flow-inverse-text)]"
            >
              ลองอีกครั้ง
            </button>
            <button
              type="button"
              disabled={this.state.clearing}
              onClick={this.clearAndRetry}
              className="min-h-12 rounded-2xl border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-surface-card)] px-4 font-semibold"
            >
              {this.state.clearing ? "กำลังล้างแคช…" : "ล้างแคชเริ่มต้น"}
            </button>
          </div>
          {debug ? (
            <details className="mt-5 text-xs text-[var(--flow-text-muted)]">
              <summary className="cursor-pointer font-semibold">
                รายละเอียดสำหรับ Debug
              </summary>
              <p className="mt-2 break-words">
                {debug.type}: {debug.message}
              </p>
            </details>
          ) : null}
          <p className="mt-5 text-xs leading-5 text-[var(--flow-text-muted)]">
            การล้างแคชเริ่มต้นจะไม่ลบงานใน flow_state_v2
          </p>
        </section>
      </main>
    );
  }
}
