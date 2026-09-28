"use client";

import { useRef, useState, type ReactNode } from "react";
import { useClickOutside } from "@/hooks/useClickOutside";

/** A controlled trigger+panel disclosure that closes on outside click and
 *  Escape — replaces the native <details>/<summary> pattern used
 *  everywhere in this app, which has neither. Shared by LoginMenu,
 *  LanguageSwitcher, and Rail's flyout menu. */
export function Dropdown({
  trigger,
  triggerClassName = "",
  triggerLabel,
  children,
  align = "right",
  panelClassName = "",
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Render prop so items inside can call `close()` on click (a Link
   *  navigating away unmounts anyway, but a same-page action like "log
   *  out" or "switch language" should visibly close the panel too). */
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute z-20 mt-1 ${align === "right" ? "right-0" : "left-0"} ${panelClassName}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
