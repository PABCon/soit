"use client";

import { useEffect } from "react";

/** Calls `onOutside` on a pointerdown outside `ref`'s element, and on
 *  Escape — the two things native <details> doesn't give you for free (a
 *  real-usage report found a dropdown staying open after clicking
 *  elsewhere confusing). Only listens while `active` is true. */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
) {
  useEffect(() => {
    if (!active) return;

    function handlePointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
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
  }, [active, ref, onOutside]);
}
