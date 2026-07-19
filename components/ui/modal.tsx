"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState, type ReactNode } from "react";

// Centered modal with both enter AND exit animation (panel + backdrop).
// Keeps the element mounted through the exit transition, then unmounts.
export function Modal({ open, onClose, children, panelClassName = "max-w-[340px]" }:
  { open: boolean; onClose: () => void; children: ReactNode; panelClassName?: string }) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      setRender(true);
      const r = requestAnimationFrame(() => setShow(true)); // next frame → enter transition runs
      return () => cancelAnimationFrame(r);
    }
    setShow(false); // play exit, then unmount
    const t = setTimeout(() => setRender(false), 300);
    return () => clearTimeout(t);
  }, [open]);

  if (!render) return null;
  return (
    <>
      <div className={`fixed inset-0 z-[60] mx-auto max-w-[420px] bg-black/40 transition-opacity duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${show ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className="fixed inset-x-0 top-1/2 z-[61] mx-auto -translate-y-1/2 px-6">
        <div className={`mx-auto rounded-2xl border-[1.5px] border-[var(--flow-ink)] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,.18)] transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] ${panelClassName} ${show ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"}`}
          onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </>
  );
}
