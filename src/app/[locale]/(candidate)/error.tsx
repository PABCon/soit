"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ErrorPageCard } from "@/components/ErrorPageCard";
import { buttonClassName } from "@/components/Button";

/** 500/runtime-error boundary — lives inside `(candidate)` so it renders
 *  inside the real site shell, same as `not-found.tsx`. Next.js requires
 *  this to be a Client Component (it receives `error`/`reset` and "Try
 *  again" has to actually re-render the failed segment) — `useTranslations`/
 *  the client-side `Link`, not the server equivalents `not-found.tsx` uses.
 *  Reports to Sentry same as `global-error.tsx` does for root-layout
 *  failures — this is the first route-level error boundary in the app, so
 *  without this, an error caught *here* (as opposed to one severe enough
 *  to blow past the layout entirely) had no reporting path at all. */
export default function CandidateError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPages");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <ErrorPageCard
      eyebrow={t("serverErrorEyebrow")}
      code="500"
      headline={t("serverErrorHeadline")}
      body={t("serverErrorBody")}
      primaryAction={
        <button type="button" onClick={reset} className={buttonClassName({ size: "md" })}>
          {t("serverErrorPrimaryCta")}
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </button>
      }
      secondaryAction={
        <Link href="/jobs" className={buttonClassName({ variant: "secondary", size: "md" })}>
          {t("serverErrorSecondaryCta")}
        </Link>
      }
      links={[
        { label: t("serverErrorLinkHome"), href: "/jobs" },
        { label: t("serverErrorLinkCompanies"), href: "/companies" },
      ]}
      illustrationSrc="/illustrations/500-robot.png"
      illustrationAlt=""
      chip={t("serverErrorChip")}
    />
  );
}
