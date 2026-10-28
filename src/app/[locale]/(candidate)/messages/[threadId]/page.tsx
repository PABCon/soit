import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Building2 } from "lucide-react";
import { redirect, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getThreadDetail } from "@/lib/db/messaging";
import { ThreadReplyBox } from "@/components/ThreadReplyBox";
import { MessageAttachment } from "@/components/messaging/MessageAttachment";
import { ThreadRealtimeRefresh } from "@/components/messaging/ThreadRealtimeRefresh";
import { sendCandidateMessageAction } from "./actions";

type Props = { params: Promise<{ locale: string; threadId: string }> };

// SEO audit finding: every sibling private page (/messages, /applications,
// /favorites, /profile, /saved-searches, /settings) sets this explicitly —
// this one was missed, silently inheriting the root layout's public
// defaults. Auth already blocks a real visitor, but a private page
// shouldn't rely on that alone.
export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function CandidateThreadPage({ params }: Props) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "messaging" });
  const format = await getFormatter({ locale });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect({ href: "/candidate/login", locale });

  const thread = await getThreadDetail(threadId);
  if (!thread.ok) notFound();
  if (thread.role !== "candidate") notFound();

  const initial = thread.companyName.trim().charAt(0).toUpperCase() || null;

  const messagesWithDateSeparators = thread.messages.reduce<
    { message: (typeof thread.messages)[number]; showDateSeparator: boolean }[]
  >((acc, message) => {
    const dateKey = new Date(message.createdAt).toDateString();
    const previousDateKey = acc.length > 0 ? new Date(acc[acc.length - 1].message.createdAt).toDateString() : "";
    acc.push({ message, showDateSeparator: dateKey !== previousDateKey });
    return acc;
  }, []);

  return (
    <>
      <ThreadRealtimeRefresh threadId={threadId} />
      <Link href="/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-pine hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("inboxTitle")}
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xl font-semibold text-pine">
          {initial ?? <Building2 className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 pt-1">
          <h1 className="text-2xl font-bold lg:text-3xl">{thread.companyName}</h1>
          <p className="mt-0.5 text-sm text-muted">{thread.jobTitle}</p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <ul className="space-y-3">
          {messagesWithDateSeparators.map(({ message: m, showDateSeparator }) => {
            const isCandidate = m.senderType === "candidate";
            return (
              <li key={m.id}>
                {showDateSeparator && (
                  <div className="my-4 flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-line" />
                    <span className="rounded-full bg-subtle px-3 py-1 text-xs font-medium text-muted">
                      {format.dateTime(new Date(m.createdAt), { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <div className={isCandidate ? "flex justify-end" : "flex items-end gap-2"}>
                  {!isCandidate && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-semibold text-pine">
                      {initial ?? <Building2 className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  )}
                  <div
                    className={
                      isCandidate
                        ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-pine px-4 py-2.5 text-sm text-white"
                        : "max-w-[80%] rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-ink"
                    }
                  >
                    {(!m.attachment || m.body !== m.attachment.filename) && <p>{m.body}</p>}
                    {m.attachment && <MessageAttachment attachment={m.attachment} tone={isCandidate ? "own" : "other"} />}
                    <p className={isCandidate ? "mt-1 text-[11px] text-white/70" : "mt-1 text-[11px] text-muted"}>
                      {format.dateTime(new Date(m.createdAt), { timeStyle: "short" })}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ThreadReplyBox onSend={sendCandidateMessageAction.bind(null, threadId)} />
    </>
  );
}
