import { getTranslations } from "next-intl/server";

export type AdCreditPurchaseRow = {
  id: string;
  quantity: number;
  total_cents: number;
  currency: string;
  created_at: string;
};

/** Billing dashboard — critical-bugs QA item: employers had no way to see
 *  past purchases at all. Ad-credit purchases are one-time Stripe
 *  Checkout (no recurring invoice, no Stripe Customer object), so this is
 *  a direct read of `job_ad_purchases` rather than a Stripe API call —
 *  the ledger this project already writes on every fulfilled purchase is
 *  itself the invoice history, nothing to fetch from Stripe. Top
 *  Employer's own recurring invoices live in Stripe's hosted Customer
 *  Portal instead (see "Manage billing" in TopEmployerCard) — that's
 *  where real multi-invoice history with PDFs belongs, not reimplemented
 *  here. */
export async function BillingHistory({ purchases, locale }: { purchases: AdCreditPurchaseRow[]; locale: string }) {
  const t = await getTranslations({ locale, namespace: "console" });

  if (purchases.length === 0) {
    return <p className="text-sm text-muted">{t("billingHistoryEmpty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-semibold tracking-wide text-muted uppercase">
            <th className="px-4 py-3">{t("billingHistoryDate")}</th>
            <th className="px-4 py-3">{t("billingHistoryItem")}</th>
            <th className="px-4 py-3">{t("billingHistoryAmount")}</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
