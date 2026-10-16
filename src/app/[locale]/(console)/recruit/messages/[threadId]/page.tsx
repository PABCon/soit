import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { ArrowLeft, Check, MessageSquare, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getThreadDetail } from "@/lib/db/messaging";
import { ThreadComposer } from "@/components/console/ThreadComposer";
import { MessageAttachment } from "@/components/messaging/MessageAttachment";
import { ThreadRealtimeRefresh } from "@/components/messaging/ThreadRealtimeRefresh";
import { sendEmployerMessageAction } from "./actions";

type Props = { params: Promise<{ locale: string; threadId: string }> };

/** Round 30 restyle. Two judgment calls resolved after checking what this
 *  feature's data model actually tracks (`supabase/migrations/
 *  20260930193000_messaging.sql`): `messages` has no per-message read/
 *  delivery column at all, only `message_threads.employer_last_read_at`/
 *  `candidate_last_read_at` (thread-level, used for the unread-badge
 *  counts) — so the reference's double-checkmark "read" receipt isn't
 *  backed by anything real. Rendered as a single checkmark instead,
 *  meaning only "sent" (true of every row here by construction — the
 *  message already exists), never a read/delivered claim this app can't
 *  back up. */
export default async function EmployerThreadPage({ params }: Props) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "messaging" });
  const format = await getFormatter({ locale });

  const thread = await getThreadDetail(threadId);
  if (!thread.ok) notFound();
  if (thread.role !== "employer") notFound();

  const candidateName = thread.candidateName ?? t("candidateAnonymous");
  const initial = thread.candidateName?.trim().charAt(0).toUpperCase() || null;

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
      <Link href="/recruit/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-pine hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("inboxTitle")}
      </Link>

      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xl font-semibold text-pine">
          {initial ?? <User className="h-6 w-6" aria-hidden="true" />}
        </span>
        <div className="min-w-0 pt-1">
          <h1 className="text-2xl font-bold lg:text-3xl">{candidateName}</h1>
          <p className="mt-0.5 text-sm text-muted">
            {thread.jobTitle} · {thread.companyName}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {t("conversationContext")}
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-line bg-white p-4">
        <ul className="space-y-3">
          {messagesWithDateSeparators.map(({ message: m, showDateSeparator }) => {
            const isEmployer = m.senderType === "employer";

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
                <div className={isEmployer ? "flex justify-end" : "flex items-end gap-2"}>
                  {!isEmployer && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pine/10 text-xs font-semibold text-pine">
                      {initial ?? <User className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  )}
                  <div
                    className={
                      isEmployer
                        ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-pine px-4 py-2.5 text-sm text-white"
                        : "max-w-[80%] rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-ink"
                    }
                  >
                    {(!m.attachment || m.body !== m.attachment.filename) && <p>{m.body}</p>}
                    {m.attachment && <MessageAttachment attachment={m.attachment} tone={isEmployer ? "own" : "other"} />}
                    <p
                      className={
                        isEmployer
                          ? "mt-1 flex items-center justify-end gap-1 text-[11px] text-white/70"
                          : "mt-1 text-[11px] text-muted"
                      }
                    >
                      {format.dateTime(new Date(m.createdAt), { timeStyle: "short" })}
                      {isEmployer && <Check className="h-3 w-3" aria-hidden="true" />}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ThreadComposer onSend={sendEmployerMessageAction.bind(null, threadId)} />
    </>
  );
}
