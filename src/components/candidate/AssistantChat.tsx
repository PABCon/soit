"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { JobRow } from "@/components/JobRow";
import { ChatMarkdown } from "@/components/candidate/ChatMarkdown";
import { CompanyCard } from "@/components/candidate/CompanyCard";
import { InlineAuthCard } from "@/components/candidate/InlineAuthCard";
import { Link } from "@/i18n/navigation";
import { serializeJobFilterParams } from "@/lib/jobs/match-filters";
import type { SearchJobsArgs, SearchJobsResult } from "@/lib/assistant/search-jobs";
import type { LookupCompanyToolResult } from "@/lib/assistant/lookup-company";
import type { CalculateSalaryToolResult } from "@/lib/assistant/calculate-salary";
import type { CalculateTerminationToolResult } from "@/lib/assistant/calculate-termination";
import type { PreviewApplyToolResult } from "@/lib/assistant/apply-job";
import type { ApplyResult } from "@/lib/db/applications";

const EXAMPLE_KEYS = ["exampleOne", "exampleTwo", "exampleThree"] as const;

function JtAvatar({ className = "h-8 w-8" }: { className?: string }) {
  // Same plain-img convention RecommendationsTeaser/AssistantTeaser
  // already use for their own static illustrations; a small avatar isn't
  // worth next/image's overhead.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/jt-avatar.png" alt="" className={`shrink-0 rounded-full object-cover ${className}`} />;
}

/** Static, context-aware quick replies shown under the most recent
 *  search result only, grounded in the actual args the tool was just
 *  called with (never a fabricated suggestion unrelated to what's on
 *  screen), matching the reference design's "suggested follow-ups" row.
 *  Clicking one just sends its own text as a normal next message; the
 *  model combines it with the existing conversation itself, no special
 *  client-side filter-merging logic needed. */
function suggestFollowUps(args: SearchJobsArgs, t: (key: string) => string): string[] {
  const suggestions: string[] = [];
  if (!args.remoteOnly) suggestions.push(t("followUpRemote"));
  if (!(args.seniority ?? []).includes("senior")) suggestions.push(t("followUpSenior"));
  suggestions.push(t("followUpCompare"));
  return suggestions.slice(0, 3);
}

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
export function AssistantChat({ initialQuery }: { initialQuery?: string }) {
  const t = useTranslations("assistant");
  const ta = useTranslations("apply");
  const locale = useLocale();
  const [input, setInput] = useState("");
  const { messages, sendMessage, setMessages, status, error } = useChat({
    // The route itself isn't locale-prefixed; this static `body` is
    // merged into every request so the calculator tools can build a
    // correct `/${locale}/salario-liquido`-style shareable link.
    transport: new DefaultChatTransport({ api: "/api/assistant", body: { locale } }),
  });

  function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    sendMessage({ text: trimmed });
    setInput("");
  }

  // The /jobs page's own "ask JT" banner hands off a first query via
  // ?q=... on the URL, sent once automatically, so landing here from
  // that banner is a single motion rather than "type it again."
  const sentInitialQuery = useRef(false);
  useEffect(() => {
    if (!initialQuery) return;
    // Dev-mode React Strict Mode double-invokes this effect (mount,
    // cleanup, mount again) synchronously before the browser yields to
    // the event loop. Marking `sentInitialQuery` true at the top of the
    // effect body (the obvious guard) still lets the *first* invocation's
    // sendMessage() call fire, only for its underlying request to be
    // aborted a moment later by the synthetic cleanup, with the guard
    // then correctly preventing the second invocation from retrying.
    // Net effect: zero messages ever actually sent. Deferring the actual
    // send via a cleared-on-cleanup timeout is the standard fix: both
    // synthetic invocations schedule and immediately cancel their own
    // timer, so only the one effect instance that survives past the
    // synchronous double-invoke dance ever fires its callback.
    const timer = setTimeout(() => {
      if (sentInitialQuery.current) return;
      sentInitialQuery.current = true;
      handleSend(initialQuery);
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const isBusy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);

  return (
    // 8rem = the candidate shell's own fixed chrome above this page: the
    // 4rem (h-16) sticky TopNav plus <main>'s own 4rem (py-8) of vertical
    // padding. Sized to exactly fill what's left of the viewport (real-
    // usage ask: the whole widget, header to input, should fit on load
    // with no outer page scroll needed to reach it); only this box's own
    // message list scrolls internally, below.
    <div className="flex h-[calc(100dvh-8rem)] flex-col rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <JtAvatar className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">{t("chatName")}</p>
            <p className="truncate text-xs text-muted">{t("chatSubtitle")}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-pine hover:text-pine"
          >
            {t("newChat")}
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          // Real-usage ask: no separate "welcome" banner above the chat.
          // The opening line is just JT's own first message, styled
          // exactly like any other assistant reply below, not a distinct
          // heading treatment.
          <div className="flex items-start gap-2.5">
            <JtAvatar className="mt-0.5 h-7 w-7" />
            <div className="max-w-[90%] space-y-3">
              <p className="rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-ink">{t("openingMessage")}</p>
              <div>
                <p className="px-1 text-xs text-muted">{t("examplesHeading")}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLE_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSend(t(key))}
                      className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-pine hover:text-pine"
                    >
                      {t(key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}
          >
            {message.role === "assistant" && <JtAvatar className="mt-0.5 h-7 w-7" />}
            <div className={message.role === "user" ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-pine px-4 py-2.5 text-sm text-white" : "min-w-0 max-w-[90%] space-y-3"}>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  if (message.role === "user") {
                    return <p key={index}>{part.text}</p>;
                  }
                  // The model reliably formats comparisons/breakdowns with
                  // "- " bullets and "**bold**" field labels: a plain <p>
                  // collapsed that structure into one unreadable run-on
                  // line (real-usage bug). ChatMarkdown parses the same
                  // minimal structure JobDescriptionBody.tsx already does.
                  return (
                    <ChatMarkdown
                      key={index}
                      text={part.text}
                      className="space-y-2 rounded-2xl rounded-tl-sm bg-subtle px-4 py-2.5 text-sm text-ink"
                    />
                  );
                }

                if (part.type === "tool-searchJobs" && part.state === "output-available") {
                  // `useChat` has no compile-time link to this route's own
                  // tool definition (that would mean importing server-only
                  // code into the client bundle), these casts are scoped
                  // to the two shapes `searchJobs()` itself actually has,
                  // re-exported from the same module the route uses.
                  const { jobs, count, filters } = part.output as SearchJobsResult;
                  const args = part.input as SearchJobsArgs;
                  const isLastMessage = message.id === lastMessage?.id;
                  // Real-usage bug: this used to link to a bare /jobs,
                  // silently dropping everything the conversation had
                  // established. `filters` is the real, revalidated set
                  // this search actually ran with, serialized the exact
                  // same way /jobs's own JobsExplorer reads it, so this
                  // reproduces the identical filtered view, not a guess.
                  const viewAllHref = `/jobs?${serializeJobFilterParams(filters).toString()}`;
                  return (
                    <div key={index} className="space-y-2">
                      <p className="px-1 text-xs font-medium text-muted">
                        {count === 0 ? t("noResults") : t("resultsCount", { count })}
                      </p>
                      {/* JobRow's own root is an <li> (same as everywhere
                       *  else it's used, e.g. JobsExplorer.tsx): a real
                       *  stray bullet marker shows up without a real <ul>
                       *  wrapper, caught by live verification. */}
                      <ul className="flex flex-col gap-2">
                        {jobs.map((job) => (
                          <JobRow key={job.id} job={job} />
                        ))}
                      </ul>
                      {count > jobs.length && (
                        <Link href={viewAllHref} className="block px-1 text-xs font-medium text-pine hover:underline">
                          {t("viewAllOnJobsPage")}
                        </Link>
                      )}
                      {jobs.length > 0 && isLastMessage && !isBusy && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {suggestFollowUps(args, t).map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handleSend(label)}
                              className="rounded-full border border-line bg-white px-3 py-1 text-xs font-medium text-pine hover:border-pine"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }

                if (part.type === "tool-lookupCompany" && part.state === "output-available") {
                  const companyResult = part.output as LookupCompanyToolResult;
                  // A not-found match isn't rendered as a card, the
                  // model's own text (instructed to say so plainly) is
                  // the only feedback for that case.
                  return companyResult.ok ? <CompanyCard key={index} company={companyResult} /> : null;
                }

                if (part.type === "tool-calculateSalary" && part.state === "output-available") {
                  const salaryResult = part.output as CalculateSalaryToolResult;
                  if (!salaryResult.ok) return null;
                  return (
                    <a
                      key={index}
                      href={salaryResult.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-pine hover:underline"
                    >
                      {t("viewFullBreakdown")} →
                    </a>
                  );
                }

                if (part.type === "tool-calculateTermination" && part.state === "output-available") {
                  const terminationResult = part.output as CalculateTerminationToolResult;
                  if (!terminationResult.ok) return null;
                  return (
                    <a
                      key={index}
                      href={terminationResult.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-xl border border-line bg-white px-3 py-2 text-xs font-medium text-pine hover:underline"
                    >
                      {t("viewFullBreakdown")} →
                    </a>
                  );
                }

                if (part.type === "tool-previewApply" && part.state === "output-available") {
                  const previewResult = part.output as PreviewApplyToolResult;
                  if (!previewResult.ok && previewResult.reason === "needs_account") {
                    return <InlineAuthCard key={index} />;
                  }
                  if (!previewResult.ok && previewResult.reason === "no_cv_on_file") {
                    return (
                      <p key={index} className="rounded-xl border border-line bg-white p-3 text-sm text-ink">
                        {t("noCvOnFile")}
                      </p>
                    );
                  }
                  // already_applied / job_not_found: the model's own
                  // text (system-prompt instructed to relay this
                  // plainly) is the only feedback for these.
                  if (!previewResult.ok) return null;
                  return (
                    <div key={index} className="space-y-1 rounded-xl border border-line bg-white p-3">
                      <p className="text-sm font-semibold text-ink">{previewResult.jobTitle}</p>
                      <p className="text-xs text-muted">{previewResult.companyName}</p>
                      <p className="pt-1 text-xs font-medium text-pine">{t("applyPreviewHint")}</p>
                    </div>
                  );
                }

                if (part.type === "tool-confirmApply" && part.state === "output-available") {
                  const applyResult = part.output as ApplyResult;
                  return (
                    <p
                      key={index}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        applyResult.ok ? "border-line bg-white text-ink" : "border-line bg-red-50 text-red-700"
                      }`}
                    >
                      {applyResult.ok ? t("applySuccessMessage") : ta(`error.${applyResult.reason}`)}
                    </p>
                  );
                }

                if (
                  (part.type === "tool-searchJobs" ||
                    part.type === "tool-lookupCompany" ||
                    part.type === "tool-calculateSalary" ||
                    part.type === "tool-calculateTermination" ||
                    part.type === "tool-previewApply" ||
                    part.type === "tool-confirmApply") &&
                  part.state === "input-streaming"
                ) {
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
          <div className="flex items-start gap-2.5">
            <JtAvatar className="mt-0.5 h-7 w-7" />
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
