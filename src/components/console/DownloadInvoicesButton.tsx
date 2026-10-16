"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { createBillingPortalSessionAction } from "@/app/[locale]/(console)/recruit/jobs/ads/actions";

/** Top Employer's own recurring invoices (PDFs included) live in Stripe's
 *  hosted Customer Portal — same mechanism `TopEmployerCard`'s "Manage
 *  billing" already uses. Only rendered for an active subscriber (see
 *  `page.tsx`'s `canManageBilling`): a company with only one-time
 *  ad-credit purchases has no Stripe Customer object, so no portal to
 *  open — its per-row receipt links below are the only invoice access
 *  it has. */
export function DownloadInvoicesButton() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  async function go() {
    setPending(true);
    try {
      const result = await createBillingPortalSessionAction(locale);
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={go}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-pine hover:underline disabled:opacity-50"
    >
      <Download className="h-4 w-4" />
      {pending ? t("redirecting") : t("downloadInvoices")}
    </button>
  );
}
