import { ArrowRight } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ErrorPageCard } from "@/components/ErrorPageCard";
import { buttonClassName } from "@/components/Button";

/** 404 page — lives inside `(candidate)` so it automatically renders
 *  inside the real site shell (TopNav/Rail/Footer), same as every other
 *  page under this route group. `not-found.tsx` gets no `params` at all
 *  (a real Next.js limitation, unlike a normal `page.tsx`) — `getLocale()`
 *  reads the locale the parent layout already set for this request,
 *  same pattern `TopNav.tsx` already uses for the same reason. */
export default async function CandidateNotFound() {
  const locale = await getLocale();
  const t = await getTranslations({ locale, namespace: "errorPages" });

  return (
    <ErrorPageCard
      eyebrow={t("notFoundEyebrow")}
      code="404"
      headline={t("notFoundHeadline")}
      body={t("notFoundBody")}
      primaryAction={
        <Link href="/jobs" className={buttonClassName({ size: "md" })}>
          {t("notFoundPrimaryCta")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      }
      secondaryAction={
        <Link href="/companies" className={buttonClassName({ variant: "secondary", size: "md" })}>
          {t("notFoundSecondaryCta")}
        </Link>
      }
      links={[
        { label: t("notFoundLinkJobs"), href: "/jobs" },
        { label: t("notFoundLinkCompanies"), href: "/companies" },
        { label: t("notFoundLinkPostJob"), href: "/recruit" },
      ]}
      illustrationSrc="/illustrations/404-signpost.png"
      illustrationAlt=""
    />
  );
}
