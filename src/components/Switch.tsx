"use client";

/** A real pill toggle switch — a real-usage report found the native
 *  checkbox for "remote only" ugly. Plain Tailwind + the `peer` modifier,
 *  no new dependency. */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink select-none">
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        {/* The input itself is sr-only (no visible box of its own), so
         *  without this the global :focus-visible outline rule would have
         *  nothing to actually draw around — a real, silent keyboard-
         *  accessibility gap. peer-focus-visible puts that same feedback
         *  on the visible track instead. */}
        <span className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-pine peer-focus-visible:ring-2 peer-focus-visible:ring-pine peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
      {label}
    </label>
  );
}
