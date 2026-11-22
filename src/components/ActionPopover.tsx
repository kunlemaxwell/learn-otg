"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
export type MenuAnchor = { left: number; top: number; bottom: number; width: number };
/** One compact, anchored surface for secondary actions across the app. */
export function ActionPopover({ anchor, label, children, onClose, side = "top", width = 280 }: { anchor: MenuAnchor; label: string; children: ReactNode; onClose: () => void; side?: "top" | "bottom"; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focus = requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("button, input, select, a")?.focus());
    const outside = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); onClose(); previous?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(focus); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const w = Math.min(width, window.innerWidth - 24);
  const left = Math.max(12, Math.min(anchor.left, window.innerWidth - w - 12));
  const above = side === "top" ? anchor.top > 220 : window.innerHeight - anchor.bottom < 260;
  return createPortal(<div ref={ref} className="action-popover no-export" role="dialog" aria-label={label} style={{ width: w, left, ...(above ? { bottom: Math.max(12, window.innerHeight - anchor.top + 8) } : { top: Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - 230)) }) }}>{children}</div>, document.body);
}
