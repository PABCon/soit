"use client";

import { useEffect } from "react";

/** Calls `onOutside` on a pointerdown outside `ref`'s element, and on
 *  Escape — the two things native <details> doesn't give you for free (a
 *  real-usage report found a dropdown staying open after clicking
 *  elsewhere confusing). Only listens while `active` is true.
 *
 *  `extraRef` covers a second element that should also count as
 *  "inside" — specifically `Dropdown`'s portal mode, whose panel is
 *  appended to `document.body` and therefore isn't a DOM descendant of
 *  `ref` at all, even though it's the same logical control. */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
  extraRef?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!active) return;

    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const insideMain = ref.current?.contains(target) ?? false;
      const insideExtra = extraRef?.current?.contains(target) ?? false;
      if (!insideMain && !insideExtra) onOutside();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [active, ref, onOutside, extraRef]);
}
