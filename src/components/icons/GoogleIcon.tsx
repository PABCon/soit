/**
 * Real Google brand mark for the OAuth login button. Path/hex extracted
 * once from `simple-icons` (same one-time-extraction convention as
 * `FacebookIcon.tsx`/`tech-icons.tsx`) — that package is NOT a runtime
 * dependency here. Note: simple-icons only ships Google's flat single-
 * color mark (#4285F4), not the four-color "G" most sign-in buttons use —
 * confirmed via its raw data file (no alternate multi-color variant
 * exists in that source). Reconstructing the official four-color
 * version by hand would be hand-drawing a trademarked logo approximation,
 * which this codebase's own icon-extraction convention (tech-icons.tsx)
 * deliberately avoids — so this is the single-color mark, not the
 * familiar four-color one.
 */
const PATH =
  "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z";
const HEX = "4285F4";

export function GoogleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={`#${HEX}`} aria-hidden="true">
      <path d={PATH} />
    </svg>
  );
}
