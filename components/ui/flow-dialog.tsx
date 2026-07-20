"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

const FOCUSABLE = "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function FlowDialog({ title, description, onClose, children, role = "dialog" }: { title: string; description?: string; onClose: () => void; children: React.ReactNode; role?: "dialog" | "alertdialog" }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    closeTimerRef.current = window.setTimeout(() => closeRef.current(), 180);
  }, []);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const preferred = panelRef.current?.querySelector<HTMLElement>("[data-autofocus='true']");
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? first ?? panelRef.current)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      const elements = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!elements.length) { event.preventDefault(); panelRef.current.focus(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [requestClose]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const sync = () => setViewportHeight(viewport?.height ?? window.innerHeight);
    sync();
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return (
    <div className={`${closing ? "flow-backdrop-out" : "flow-backdrop"} fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={panelRef} tabIndex={-1} style={viewportHeight ? { maxHeight: `${Math.max(280, viewportHeight - 8)}px` } : undefined} className={`${closing ? "flow-sheet-out" : "flow-sheet"} max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[24px] border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--flow-shadow)] outline-none sm:rounded-[24px]`} role={role} aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
        <header className="mb-4 flex items-center justify-between border-b flow-hairline pb-3">
          <h2 id={titleId} className="text-xl font-bold tracking-[-0.01em]">{title}</h2>
          <button type="button" aria-label="ปิดหน้าต่าง" className="flow-press grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)]" onClick={requestClose}><X size={18} /></button>
        </header>
        {description && <p id={descriptionId} className="sr-only">{description}</p>}
        {children}
      </section>
    </div>
  );
}
