"use client";

import type { ReactNode } from "react";

/** Shared lightweight modal wrapper — overlay + centered panel, click-
 *  outside or the × to close. Originally lived inline in ApplyModal.tsx;
 *  extracted so EngagementPopup can reuse the exact same look. `maxWidthClassName`
 *  defaults to the original `max-w-md` — only the CV-autofill review (§AI
 *  Pieces backlog) needs more room, for its skills/languages/education
 *  sections. */
export function Modal({
  onClose,
  children,
  maxWidthClassName = "max-w-md",
}: {
  onClose: () => void;
  children: ReactNode;
  maxWidthClassName?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${maxWidthClassName} overflow-y-auto rounded-xl bg-white p-6 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="float-right -mt-2 -mr-2 text-xl text-muted hover:text-ink"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
