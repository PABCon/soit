import { getTranslations, setRequestLocale } from "next-intl/server";
import { getInviteByToken } from "@/lib/db/team";
import { InviteAcceptForm } from "@/components/auth/InviteAcceptForm";

type Props = { params: Promise<{ locale: string; token: string }> };

export default async function AcceptInvitePage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "auth" });

  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <div className="mx-auto w-full max-w-sm px-4 py-10">
        <p className="text-sm text-muted">{t("inviteInvalid")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold text-ink">{t("inviteTitle")}</h1>
      <p className="mb-6 text-sm text-muted">
        {t("inviteBody", { company: invite.companyName })}
      </p>
      <InviteAcceptForm email={invite.email} />
    </div>
  );
}
