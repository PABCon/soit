import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getCompanyMembers, getPendingInvites } from "@/lib/db/team";
import { TeamManager } from "@/components/console/TeamManager";

type Props = { params: Promise<{ locale: string }> };

export default async function TeamPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "console" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  const [members, invites] = await Promise.all([
    getCompanyMembers(ctx.company.id),
    ctx.role === "owner" ? getPendingInvites(ctx.company.id) : Promise.resolve([]),
  ]);

  return (
    <>
      <h1 className="text-2xl font-bold">{t("team")}</h1>
      <div className="mt-6">
        <TeamManager members={members} invites={invites} isOwner={ctx.role === "owner"} myEmployerId={ctx.employerId} />
      </div>
    </>
  );
}
