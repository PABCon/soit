/** Two-column shell for the four role×mode auth pages (round 21): a
 *  decorative hero panel (hidden below `lg` — the form itself is the only
 *  essential content at phone width) and a white card holding the real
 *  form. Scoped to just these four pages — the other `(auth)` pages
 *  (forgot/reset-password, accept-invite) keep their own simple centered
 *  column, unaffected by this. */
export function AuthSplitScreen({ hero, children }: { hero: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative hidden flex-1 overflow-hidden bg-subtle lg:flex lg:items-center lg:justify-center lg:px-16 lg:py-12">
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-pine/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-pine/15" aria-hidden="true" />
        <div className="relative w-full max-w-md">{hero}</div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
