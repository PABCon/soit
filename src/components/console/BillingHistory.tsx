import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { DownloadInvoicesButton } from "@/components/console/DownloadInvoicesButton";

export type AdCreditPurchaseRow = {
  id: string;
  quantity: number;
  total_cents: number;
  currency: string;
  created_at: string;
  receipt_url?: string | null;
};

/** Billing dashboard — critical-bugs QA item: employers had no way to see
 *  past purchases at all. Ad-credit purchases are one-time Stripe
 *  Checkout (no recurring invoice, no Stripe Customer object), so this is
 *  a direct read of `job_ad_purchases` rather than a Stripe API call —
 *  the ledger this project already writes on every fulfilled purchase is
 *  itself the invoice history, nothing to fetch from Stripe for it. Top
 *  Employer's own recurring invoices live in Stripe's hosted Customer
 *  Portal instead (see "Manage billing" in TopEmployerCard) — that's
 *  where real multi-invoice history with PDFs belongs, not reimplemented
 *  here. Per-row `Download` uses the real Stripe charge receipt_url
 *  (`job_ad_purchases.receipt_url`, migration 20261016120000), captured
 *  once by the webhook at fulfillment time (see `fetchReceiptUrl` in
 *  `api/stripe/webhook/route.ts`) rather than calling the Stripe API on
 *  every page render. A row purchased before that column existed just
 *  shows "—". */
export async function BillingHistory({
  purchases,
  locale,
  canManageBilling,
}: {
  purchases: AdCreditPurchaseRow[];
  locale: string;
  canManageBilling?: boolean;
}) {
  const t = await getTranslations({ locale, namespace: "console" });

  return (
    <div>
      {canManageBilling && (
        <div className="mb-3 flex justify-end">
          <DownloadInvoicesButton />
        </div>
      )}
      {purchases.length === 0 ? (
        <p className="text-sm text-muted">{t("billingHistoryEmpty")}</p>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
              <th className="px-4 py-3">{t("billingHistoryDate")}</th>
              <th className="px-4 py-3">{t("billingHistoryItem")}</th>
              <th className="px-4 py-3">{t("billingHistoryAmount")}</th>
              <th className="px-4 py-3">{t("billingHistoryStatus")}</th>
              <th className="px-4 py-3">{t("billingHistoryInvoice")}</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase) => (
              <tr key={purchase.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 text-ink">
                  {new Date(purchase.created_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB")}
                </td>
                <td className="px-4 py-3 text-ink">
                  {t("billingHistoryAdCredits", { count: purchase.quantity })}
                </td>
                <td className="px-4 py-3 text-ink">
                  {(purchase.total_cents / 100).toLocaleString("en-IE", {
                    style: "currency",
                    currency: purchase.currency.toUpperCase(),
                  })}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-mint/25 px-2 py-0.5 text-xs font-semibold text-pine">{t("billingHistoryPaid")}</span>
                </td>
                <td className="px-4 py-3">
                  {purchase.receipt_url ? (
                    <a
                      href={purchase.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-pine hover:underline"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {t("billingHistoryDownload")}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
