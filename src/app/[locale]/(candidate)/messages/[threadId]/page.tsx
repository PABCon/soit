import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { redirect, Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getThreadDetail } from "@/lib/db/messaging";
import { ThreadReplyBox } from "@/components/ThreadReplyBox";
import { ThreadRealtimeRefresh } from "@/components/messaging/ThreadRealtimeRefresh";
import { sendCandidateMessageAction } from "./actions";

type Props = { params: Promise<{ locale: string; threadId: string }> };

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

  return (
    <>
      <ThreadRealtimeRefresh threadId={threadId} />
      <Link href="/messages" className="text-sm text-pine hover:underline">
        ← {t("inboxTitle")}
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">{thread.companyName}</h1>
        <p className="mt-1 text-sm text-muted">{thread.jobTitle}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={
              m.senderType === "candidate"
                ? "ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-pine px-3 py-2 text-sm text-white"
                : "mr-auto max-w-[80%] rounded-lg rounded-tl-none bg-paper px-3 py-2 text-sm text-ink"
            }
          >
            <p>{m.body}</p>
            <p className={m.senderType === "candidate" ? "mt-1 text-[10px] text-white/70" : "mt-1 text-[10px] text-muted"}>
              {format.dateTime(new Date(m.createdAt), { dateStyle: "short", timeStyle: "short" })}
            </p>
          </li>
        ))}
      </ul>

      <ThreadReplyBox onSend={sendCandidateMessageAction.bind(null, threadId)} />
    </>
  );
}
