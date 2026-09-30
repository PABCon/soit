import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getMyEmployerContext } from "@/lib/db/companies";
import { getMyThreadsAsEmployer } from "@/lib/db/messaging";

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
      <h1 className="text-2xl font-bold">{t("inboxTitle")}</h1>

      {threads.length === 0 ? (
        <p className="mt-8 text-sm text-muted">{t("noThreads")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {threads.map((thread) => (
            <li key={thread.threadId}>
              <Link
                href={`/recruit/messages/${thread.threadId}`}
                className="flex items-center justify-between gap-4 py-4 hover:bg-paper"
              >
                <div className="min-w-0 flex-1">
                  <p className={thread.unread ? "font-semibold text-ink" : "font-medium text-ink"}>
                    {thread.candidateName ?? t("candidateAnonymous")}
                  </p>
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
