"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { JobRow } from "@/components/JobRow";
import { Link } from "@/i18n/navigation";
import type { SearchJobsResult } from "@/lib/assistant/search-jobs";

const EXAMPLE_KEYS = ["exampleOne", "exampleTwo", "exampleThree"] as const;

/** A dedicated, Claude-style single-window chat for searching jobs by
 *  natural language, Phase 1 of the chat assistant plan (search/
 *  discovery only, no apply/posting/billing actions). The one tool,
 *  `searchJobs`, runs entirely server-side against the same real job
 *  data and filter predicate (`jobMatchesFilters`) /jobs itself uses, so
 *  a result shown here is never a hallucinated number or a fabricated
 *  job. Session-only by design: messages live in this component's own
 *  `useChat` state, nothing is persisted, and the conversation resets on
 *  reload. Works for anonymous visitors, same as /jobs itself, bounded
 *  by a server-side rate limit instead of a login requirement. */
export function AssistantChat() {
  const t = useTranslations("assistant");
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant" }),
  });

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  const isBusy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col rounded-xl border border-line bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-8 text-center">
            <p className="text-sm text-muted">{t("examplesHeading")}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {EXAMPLE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSend(t(key))}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink hover:border-pine hover:text-pine"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                message.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-pine px-4 py-2.5 text-sm text-white"
                  : "max-w-[90%] space-y-3"
              }
            >
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return (
                    <p key={index} className={message.role === "user" ? "" : "rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-ink"}>
                      {part.text}
                    </p>
                  );
                }

                if (part.type === "tool-searchJobs" && part.state === "output-available") {
                  // `useChat` has no compile-time link to this route's own
                  // tool definition (that would mean importing server-only
                  // code into the client bundle), this cast is scoped to
                  // the one shape `searchJobs()`'s own return type actually
                  // has, re-exported from the same module the route uses.
                  const { jobs, count } = part.output as SearchJobsResult;
                  return (
                    <div key={index} className="space-y-2">
                      <p className="px-1 text-xs font-medium text-muted">
                        {count === 0 ? t("noResults") : t("resultsCount", { count })}
                      </p>
                      {jobs.map((job) => (
                        <JobRow key={job.id} job={job} />
                      ))}
                      {count > jobs.length && (
                        <Link href="/jobs" className="block px-1 text-xs font-medium text-pine hover:underline">
                          {t("viewAllOnJobsPage")}
                        </Link>
                      )}
                    </div>
                  );
                }

                if (part.type === "tool-searchJobs" && part.state === "input-streaming") {
                  return (
                    <p key={index} className="rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-muted">
                      {t("thinking")}
                    </p>
                  );
                }

                return null;
              })}
            </div>
          </div>
        ))}

        {isBusy && messages.at(-1)?.role === "user" && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-muted">{t("thinking")}</p>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t("errorMessage")}</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex gap-2 border-t border-line p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={isBusy}
          className="h-11 flex-1 rounded-lg border border-line bg-white px-3 text-sm"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="h-11 shrink-0 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine-hover disabled:opacity-50"
        >
          {t("sendButton")}
        </button>
      </form>
    </div>
  );
}
