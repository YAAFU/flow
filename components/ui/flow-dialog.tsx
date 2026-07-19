"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

const FOCUSABLE = "button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])";

export function FlowDialog({ title, onClose, children, role = "dialog" }: { title: string; onClose: () => void; children: React.ReactNode; role?: "dialog" | "alertdialog" }) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const closeTimerRef = useRef<number | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);

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
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
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

  return (
    <div className={`${closing ? "flow-backdrop-out" : "flow-backdrop"} fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <section ref={panelRef} tabIndex={-1} className={`${closing ? "flow-sheet-out" : "flow-sheet"} max-h-[90dvh] w-full max-w-[420px] overflow-y-auto rounded-t-[24px] border-[1.5px] border-[var(--flow-line)] bg-[var(--flow-paper)] p-4 shadow-[var(--flow-shadow)] outline-none sm:rounded-[24px]`} role={role} aria-modal="true" aria-labelledby={titleId}>
        <header className="mb-4 flex items-center justify-between border-b flow-hairline pb-3">
          <h2 id={titleId} className="text-xl font-bold tracking-[-0.01em]">{title}</h2>
          <button type="button" aria-label="ปิดหน้าต่าง" className="flow-press grid h-11 w-11 place-items-center rounded-xl border border-[var(--flow-line)]" onClick={requestClose}><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}
