import { notFound } from "next/navigation";
import { getTranslations, getFormatter, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getThreadDetail } from "@/lib/db/messaging";
import { ThreadReplyBox } from "@/components/ThreadReplyBox";
import { sendEmployerMessageAction } from "./actions";

type Props = { params: Promise<{ locale: string; threadId: string }> };

export default async function EmployerThreadPage({ params }: Props) {
  const { locale, threadId } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "messaging" });
  const format = await getFormatter({ locale });

  const thread = await getThreadDetail(threadId);
  if (!thread.ok) notFound();
  if (thread.role !== "employer") notFound();

  return (
    <>
      <Link href="/recruit/messages" className="text-sm text-pine hover:underline">
        ← {t("inboxTitle")}
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">{thread.candidateName ?? t("candidateAnonymous")}</h1>
        <p className="mt-1 text-sm text-muted">{thread.jobTitle}</p>
      </div>

      <ul className="mt-6 space-y-3">
        {thread.messages.map((m) => (
          <li
            key={m.id}
            className={
              m.senderType === "employer"
                ? "ml-auto max-w-[80%] rounded-lg rounded-tr-none bg-pine px-3 py-2 text-sm text-white"
                : "mr-auto max-w-[80%] rounded-lg rounded-tl-none bg-paper px-3 py-2 text-sm text-ink"
            }
          >
            <p>{m.body}</p>
            <p className={m.senderType === "employer" ? "mt-1 text-[10px] text-white/70" : "mt-1 text-[10px] text-muted"}>
              {format.dateTime(new Date(m.createdAt), { dateStyle: "short", timeStyle: "short" })}
            </p>
          </li>
        ))}
      </ul>

      <ThreadReplyBox onSend={sendEmployerMessageAction.bind(null, threadId)} />
    </>
  );
}
