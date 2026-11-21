"use client";

import { useRef, useState, useLayoutEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "@/hooks/useClickOutside";

/** A controlled trigger+panel disclosure that closes on outside click and
 *  Escape — replaces the native <details>/<summary> pattern used
 *  everywhere in this app, which has neither. Shared by LoginMenu,
 *  LanguageSwitcher, Rail's flyout menu, and (via `portal`) the
 *  applicants-list status control. */
export function Dropdown({
  trigger,
  triggerClassName = "",
  triggerLabel,
  children,
  align = "right",
  panelClassName = "",
  portal = false,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  /** Render prop so items inside can call `close()` on click (a Link
   *  navigating away unmounts anyway, but a same-page action like "log
   *  out" or "switch language" should visibly close the panel too). */
  children: (close: () => void) => ReactNode;
  /** "auto" (real-usage bug fix): a hardcoded "left" or "right" only ever
   *  covers one trigger position. The header's own dropdowns (login,
   *  avatar menu, language switcher) share one row whose content shifts
   *  with auth state — "left" fixed an anonymous "Entrar" trigger
   *  clipping off the left edge at narrow widths, but the very same fix
   *  then clipped the signed-in avatar trigger (which sits further
   *  right once there's no "Publicar vaga" button next to it) off the
   *  *right* edge instead. "auto" measures the trigger's own position
   *  against the viewport midpoint each time it opens and picks
   *  whichever direction actually has room, so it's correct regardless
   *  of what else happens to be in that row. */
  align?: "left" | "right" | "auto";
  panelClassName?: string;
  /** Renders the panel through a portal to `document.body`, positioned
   *  against the trigger's live bounding rect via `position: fixed`
   *  instead of a CSS-relative `absolute` panel — immune to being
   *  clipped by a scrollable/overflow ancestor (e.g. a table wrapped in
   *  `overflow-x-auto`, which computes `overflow-y` to `auto` too per
   *  the CSS spec the moment either axis isn't `visible`, clipping an
   *  absolutely-positioned descendant on both axes). Bug fix:
   *  `AllApplicantsList`'s status control was clipped/scrolled by the
   *  table wrapper under the default (non-portal) mode. */
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const [resolvedAlign, setResolvedAlign] = useState<"left" | "right">(align === "auto" ? "left" : align);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useClickOutside(triggerRef, open, () => setOpen(false), portal ? panelRef : undefined);

  function resolveAlign(): "left" | "right" {
    if (align !== "auto") return align;
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return "left";
    return r.left + r.width / 2 > window.innerWidth / 2 ? "right" : "left";
  }

  function updateCoords() {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const a = resolveAlign();
    setResolvedAlign(a);
    setCoords({ top: r.bottom + 4, left: a === "right" ? r.right : r.left });
  }

  // Keep the portal panel glued to the trigger while open — a table row
  // can scroll (the exact ancestor this was built for) without the panel
  // needing to be closed first.
  useLayoutEffect(() => {
    if (!open || !portal) return;
    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, portal]);

  function toggle() {
    if (!open) {
      if (portal) updateCoords();
      else setResolvedAlign(resolveAlign());
    }
    setOpen((v) => !v);
  }

  return (
    <div ref={triggerRef} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={triggerLabel}
        onClick={toggle}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && !portal && (
        <div className={`absolute z-20 mt-1 ${resolvedAlign === "right" ? "right-0" : "left-0"} ${panelClassName}`}>
          {children(() => setOpen(false))}
        </div>
      )}
      {open &&
        portal &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            className={`fixed z-50 ${panelClassName}`}
            style={
              resolvedAlign === "right"
                ? { top: coords.top, right: window.innerWidth - coords.left }
                : { top: coords.top, left: coords.left }
            }
          >
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </div>
  );
}
