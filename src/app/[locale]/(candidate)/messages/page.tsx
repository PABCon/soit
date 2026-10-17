import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyThreadsAsCandidate } from "@/lib/db/messaging";
import { InboxRealtimeRefresh } from "@/components/messaging/InboxRealtimeRefresh";
import { CandidateMessagesInbox } from "@/components/messaging/CandidateMessagesInbox";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "rail" });
  return { title: t("communication"), robots: { index: false, follow: false } };
}

export default async function CandidateMessagesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "messaging" });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  const threads = await getMyThreadsAsCandidate();

  return (
    <>
      {candidateId && <InboxRealtimeRefresh filter={`candidate_id=eq.${candidateId}`} />}
      <h1 className="text-3xl font-bold lg:text-4xl">{t("inboxTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("candidateInboxSubtitle")}</p>

      <CandidateMessagesInbox threads={threads} />
    </>
  );
}
