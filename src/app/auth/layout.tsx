import "../globals.css";

/** Next.js "multiple root layouts" pattern (one of two in this app,
 *  alongside `[locale]/layout.tsx`): `/auth/confirm` deliberately lives
 *  outside `[locale]` (own doc comment — it's a two-sentence page that
 *  doesn't warrant wiring up the full i18n provider) and `/auth/callback`
 *  is a route handler, not a page — neither sits under any layout that
 *  provides `<html>`/`<body>`. A Next.js version bump started enforcing
 *  "every page needs a root layout" strictly (previously silently
 *  tolerated, confirmed via `npm run build` failing on this exact page
 *  after the bump) — this is that root layout, scoped to just this
 *  segment so it never touches `[locale]/layout.tsx`'s own `<html>`/
 *  `<body>` (nesting two would be invalid HTML). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
