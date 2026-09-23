"use client";

import type { ReactNode } from "react";

/** Shared lightweight modal wrapper — overlay + centered panel, click-
 *  outside or the × to close. Originally lived inline in ApplyModal.tsx;
 *  extracted so EngagementPopup can reuse the exact same look. */
export function Modal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-lg"
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
