import { getTranslations, setRequestLocale } from "next-intl/server";
import { getClaimPreview } from "@/lib/db/claim-invites";
import { ClaimForm } from "@/components/auth/ClaimForm";
import { CompanyLogo } from "@/components/CompanyLogo";

type Props = { params: Promise<{ locale: string; token: string }> };

/** "Claim your profile" (§claim-invites) — the landing page for the
 *  outreach email's link. Public, no session required: the whole point is
 *  reaching someone who's never touched Just IT before. Shows the pre-
 *  built company + draft jobs as a concrete "look what's already done"
 *  moment, then routes into ClaimForm, which still requires a real NIF —
 *  this page alone never grants anything, it's just the preview. */
export default async function ClaimPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const preview = await getClaimPreview(token);

  if (!preview) {
    return (
      <div className="mx-auto w-full max-w-sm px-4 py-10">
        <p className="text-sm text-muted">{t("claimInvalid")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <CompanyLogo company={{ slug: "", name: preview.companyName, logoUrl: preview.logoUrl }} size="lg" />
        <div>
          <h1 className="text-xl font-bold text-ink">{t("claimTitle", { company: preview.companyName })}</h1>
        </div>
      </div>

      {preview.draftJobTitles.length > 0 && (
        <div className="mb-6 rounded-xl border border-line bg-paper p-4">
          <p className="mb-2 text-sm font-medium text-ink">
            {t("claimDraftsIntro", { count: preview.draftJobTitles.length })}
          </p>
          <ul className="flex flex-col gap-1">
            {preview.draftJobTitles.map((title) => (
              <li key={title} className="text-sm text-muted">
                &bull; {title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-6 text-sm text-muted">{t("claimBody")}</p>

      <ClaimForm token={token} />
    </div>
  );
}
