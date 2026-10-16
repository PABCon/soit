"use client";

import { useMemo, useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Search, ChevronRight, MessageSquare, User } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { EmployerThreadSummary } from "@/lib/db/messaging";

/** Round 30 restyle — the employer messages inbox. Two judgment calls
 *  settled after looking closely at the reference image, not assumed:
 *  (1) the empty-state illustration replaces the list, it doesn't sit
 *  as a persistent footer under real rows — standard inbox convention,
 *  and nothing in this feature's own data model suggests otherwise.
 *  A search with zero *matches* (as opposed to zero conversations ever)
 *  gets its own small, distinct line instead, so the two "empty" cases
 *  never read as the same thing. (2) No fabricated read-receipt
 *  checkmarks here — this page never claims per-message delivery/read
 *  state (see the thread view for the matching decision there). */
export function MessagesInbox({
  threads,
  companyName,
}: {
  threads: EmployerThreadSummary[];
  companyName: string;
}) {
  const t = useTranslations("messaging");
  const format = useFormatter();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((th) => {
      const name = (th.candidateName ?? t("candidateAnonymous")).toLowerCase();
      return (
        name.includes(q) ||
        th.jobTitle.toLowerCase().includes(q) ||
        (th.lastMessagePreview ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads, query, t]);

  if (threads.length === 0) {
    return (
      <div className="mt-10 rounded-xl border border-line bg-white p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-pine/10">
          <MessageSquare className="h-7 w-7 text-pine" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink">{t("emptyHeading")}</h2>
        <p className="mt-1 text-sm text-muted">{t("emptySubtext")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-11 w-full rounded-lg border border-line bg-white pr-4 pl-9 text-sm placeholder:text-muted"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{t("noSearchResults")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {filtered.map((thread) => {
            const name = thread.candidateName ?? t("candidateAnonymous");
            const initial = thread.candidateName?.trim().charAt(0).toUpperCase() || null;
            return (
              <li key={thread.threadId}>
                <Link
                  href={`/recruit/messages/${thread.threadId}`}
                  className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 transition-colors hover:border-pine"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pine/10 text-base font-semibold text-pine">
                    {initial ?? <User className="h-5 w-5" aria-hidden="true" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={thread.unread ? "font-semibold text-ink" : "font-medium text-ink"}>{name}</p>
                    <p className="truncate text-sm text-muted">
                      {thread.jobTitle} · {companyName}
                    </p>
                    {thread.lastMessagePreview && (
                      <p className="mt-0.5 truncate text-sm text-muted">{thread.lastMessagePreview}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 self-start">
                    <span className="text-xs text-muted">
                      {format.dateTime(new Date(thread.lastMessageAt), { day: "2-digit", month: "short" })}
                    </span>
                    {thread.unread && <span className="h-2 w-2 rounded-full bg-pine" aria-hidden="true" />}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
