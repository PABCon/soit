import { getTranslations, setRequestLocale } from "next-intl/server";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getMyThreadsAsEmployer } from "@/lib/db/messaging";
import { InboxRealtimeRefresh } from "@/components/messaging/InboxRealtimeRefresh";
import { MessagesInbox } from "@/components/messaging/MessagesInbox";

type Props = { params: Promise<{ locale: string }> };

export default async function EmployerMessagesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "messaging" });

  const ctx = await getMyEmployerContext();
  if (!ctx) return <p className="text-sm text-muted">{t("notEmployer")}</p>;

  const threads = await getMyThreadsAsEmployer();

  return (
    <>
      <InboxRealtimeRefresh filter={`company_id=eq.${ctx.company.id}`} />
      <h1 className="text-3xl font-bold lg:text-4xl">{t("inboxTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("inboxSubtitle")}</p>

      <MessagesInbox threads={threads} companyName={ctx.company.company_name} />
    </>
  );
}
