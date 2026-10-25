import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { DownloadInvoicesButton } from "@/components/console/DownloadInvoicesButton";
import type { CompanyInvoice } from "@/lib/stripe";

const STATUS_STYLES: Record<CompanyInvoice["status"], string> = {
  paid: "bg-mint/25 text-pine",
  open: "bg-amber-100 text-amber-700",
  draft: "bg-paper text-muted",
  uncollectible: "bg-red-100 text-red-700",
  void: "bg-paper text-muted",
};

const STATUS_KEYS: Record<CompanyInvoice["status"], string> = {
  paid: "billingHistoryPaid",
  open: "billingHistoryStatusOpen",
  draft: "billingHistoryStatusDraft",
  uncollectible: "billingHistoryStatusUncollectible",
  void: "billingHistoryStatusVoid",
};

/** Billing dashboard — real invoice history read straight from Stripe
 *  (`getCompanyInvoices`, src/lib/stripe.ts), not a local ledger: every
 *  product (job-ad plans, Top Employer, any future custom deal) bills
 *  through the same Stripe Customer, so there's one correct source
 *  regardless of which product produced a given invoice — nothing here to
 *  keep in sync with a separate table. "Download invoices" above the
 *  table still opens the full Stripe Customer Portal for managing the
 *  subscription itself (cancel, update card) — this table is for seeing
 *  and downloading what's already been invoiced. */
export async function BillingHistory({
  invoices,
  locale,
  canManageBilling,
}: {
  invoices: CompanyInvoice[];
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
      {invoices.length === 0 ? (
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
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">
                    {new Date(invoice.date).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB")}
                  </td>
                  <td className="px-4 py-3 text-ink">{invoice.description}</td>
                  <td className="px-4 py-3 text-ink">
                    {(invoice.amountCents / 100).toLocaleString("en-IE", {
                      style: "currency",
                      currency: invoice.currency.toUpperCase(),
                    })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[invoice.status]}`}>
                      {t(STATUS_KEYS[invoice.status])}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {invoice.pdfUrl ? (
                      <a
                        href={invoice.pdfUrl}
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
