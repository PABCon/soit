import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyThreadsAsCandidate } from "@/lib/db/messaging";

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

  const threads = await getMyThreadsAsCandidate();

  return (
    <>
      <h1 className="text-2xl font-bold">{t("inboxTitle")}</h1>

      {threads.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noThreads")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {threads.map((thread) => (
            <li key={thread.threadId}>
              <Link
                href={`/messages/${thread.threadId}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className={thread.unread ? "font-semibold text-ink" : "font-medium text-ink"}>{thread.companyName}</p>
                  <p className="truncate text-sm text-muted">
                    {thread.jobTitle}
                    {thread.lastMessagePreview ? ` · ${thread.lastMessagePreview}` : ""}
                  </p>
                </div>
                {thread.unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-pine" aria-hidden />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
