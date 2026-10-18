"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import NextError from "next/error";

/**
 * Catches errors Next's own per-route `error.tsx` boundaries can't —
 * ones thrown by the root layout itself. Didn't exist at all before this
 * (confirmed: no `error.tsx`/`global-error.tsx` anywhere in `src/app`),
 * so a root-layout failure previously had no reporting path to Sentry at
 * all. Deliberately minimal — this is a last-resort fallback, not a
 * designed error page; `NextError` (Next's own default error UI) is a
 * reasonable one since the app's real styling/i18n context may itself be
 * what's broken here.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
