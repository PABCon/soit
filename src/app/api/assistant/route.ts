import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { convertToModelMessages, createUIMessageStreamResponse, isStepCount, streamText, tool, toUIMessageStream, type UIMessage } from "ai";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getLiveJobs } from "@/lib/db/jobs";
import { getTechTags } from "@/lib/db/tech-tags";
import { getJobCategories } from "@/lib/db/job-categories";
import { getLocations } from "@/lib/db/locations";
import { getSpokenLanguages } from "@/lib/db/spoken-languages";
import { searchJobs, type SearchJobsArgs, type SearchJobsVocab } from "@/lib/assistant/search-jobs";
import { logEvent } from "@/lib/events";

/** Fire-and-forget usage tracking (the "how do we track usage" ask):
 *  reuses the existing `events` table every other analytics feature in
 *  this project already writes to (see job.viewed/job.apply_clicked),
 *  rather than new infrastructure. Deliberately logs only structured,
 *  controlled-vocabulary facts (session id, turn count, result count,
 *  category/seniority/work-model/remote/salary-floor/location), never
 *  the user's own free-text message or the free-text `tech`/`q` args a
 *  model could echo back from it, same "never log raw user content"
 *  caution this project already applies to its email templates. `after()`
 *  keeps this off the response's own critical path, same pattern
 *  `applications.ts` already established for its own notification sends. */
function trackAssistantEvent(type: string, payload: Record<string, unknown>) {
  try {
    after(() => logEvent(type, payload));
  } catch {
    void logEvent(type, payload);
  }
}

// This project's first streaming, tool-calling AI feature: every other
// file under src/lib/ai/ is one-shot generateText/Output.object. Every
// API shape here (streamText/tools/inputSchema/createUIMessageStreamResponse/
// toUIMessageStream/isStepCount) was confirmed directly against the
// installed ai@7.0.169 package's own bundled docs (node_modules/ai/docs/)
// before writing this, not from memory, the same discipline that
// already caught one real deprecated-API surprise in this codebase
// (generateObject -> generateText+Output.object).
const MODEL = "anthropic/claude-sonnet-5.5";

export const maxDuration = 30;

// Phase 1 is search/discovery only: anonymous visitors can use this with
// no login, same as /jobs itself. A real cost center with no auth gate,
// though, so it needs its own cap, same Upstash sliding-window pattern
// already used for the public API (src/lib/api/rate-limit.ts), keyed by
// a persistent anonymous session cookie rather than raw IP (a shared/
// office IP shouldn't unfairly throttle every visitor behind it).
const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "60 m"),
  prefix: "assistant-chat-ratelimit",
});

const SESSION_COOKIE = "jobs_assistant_session";

function getSessionId(req: Request): { sessionId: string; isNew: boolean } {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
  if (match) return { sessionId: match[1], isNew: false };
  return { sessionId: randomUUID(), isNew: true };
}

function buildSystemPrompt(vocab: {
  categories: { slug: string; label: string }[];
  languages: { slug: string; label: string }[];
  locations: { slug: string; name: string; country: string }[];
}): string {
  return [
    "You are the Just IT job search assistant. You help candidates find IT jobs in Portugal through natural conversation instead of manually filtering a job board.",
    "",
    "Use the searchJobs tool whenever the user describes what they're looking for (a technology, a location, a seniority level, a salary floor, remote-only, etc.), even if the description is partial. Call it again if the user refines their request.",
    "",
    "For the `tech` field: pass the technology name as the user wrote it, in its common/standard spelling (e.g. 'React', 'Python', 'Kubernetes'). Do not invent or guess a technology the user didn't mention.",
    "",
    `For the \`categorySlug\` field, choose the single best match from this real list (slug: label): ${vocab.categories.map((c) => `${c.slug}: ${c.label}`).join(", ")}.`,
    "",
    `For the \`reqLanguageSlug\` field, choose from this real list (slug: label): ${vocab.languages.map((l) => `${l.slug}: ${l.label}`).join(", ")}.`,
    "",
    `For the \`locationSlug\` field (only when the user names a specific city/place to search near), choose from this real list (slug: name, country): ${vocab.locations.map((l) => `${l.slug}: ${l.name}, ${l.country}`).join(", ")}. Never invent a location not in this list, if the user names a city that isn't here, search without a location filter instead and say so.`,
    "",
    "`seniority` accepts only: junior, mid, senior, lead. `workModel` accepts only: remote, hybrid, office. `employmentType` accepts only: permanent, fixed_term, contractor, freelance, internship.",
    "",
    "After the tool returns, summarize the results in one or two sentences using the real count it gives you, never a made-up number. If there are zero matches, say so plainly and suggest broadening the search rather than inventing a result.",
    "",
    "This assistant can only search and describe jobs right now, it cannot submit an application, post a job, or take any other action. If asked to do something else, say so plainly rather than attempting it.",
  ].join("\n");
}

export async function POST(req: Request) {
  const { sessionId, isNew } = getSessionId(req);
  const { success } = await ratelimit.limit(sessionId);
  if (!success) {
    return new Response("Too many messages. Please try again later.", { status: 429 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  trackAssistantEvent("assistant.message_sent", {
    sessionId,
    isNewSession: isNew,
    turn: messages.filter((m) => m.role === "user").length,
  });

  const [allJobs, techTags, categories, locations, languages] = await Promise.all([
    getLiveJobs(),
    getTechTags(),
    getJobCategories(),
    getLocations(),
    getSpokenLanguages(),
  ]);

  const vocab: SearchJobsVocab = {
    tech: techTags.map((t) => ({ label: t.label, aliases: t.aliases })),
    categorySlugs: categories.map((c) => c.slug),
    languageSlugs: languages.map((l) => l.slug),
    locations: locations.map((l) => ({ slug: l.slug, latitude: l.latitude, longitude: l.longitude })),
  };

  const result = streamText({
    model: MODEL,
    system: buildSystemPrompt({ categories, languages, locations }),
    messages: await convertToModelMessages(messages),
    tools: {
      searchJobs: tool({
        description: "Search live IT job postings on Just IT by technology, category, location, seniority, work model, employment type, required language, remote-only, or minimum monthly salary (EUR).",
        inputSchema: z.object({
          q: z.string().optional().describe("Free-text keyword to match against the job title"),
          tech: z.array(z.string()).optional().describe("Technology names mentioned by the user, in their common spelling"),
          categorySlug: z.string().optional(),
          seniority: z.array(z.enum(["junior", "mid", "senior", "lead"])).optional(),
          workModel: z.array(z.enum(["remote", "hybrid", "office"])).optional(),
          employmentType: z.array(z.enum(["permanent", "fixed_term", "contractor", "freelance", "internship"])).optional(),
          reqLanguageSlug: z.array(z.string()).optional(),
          remoteOnly: z.boolean().optional(),
          minSalary: z.number().optional().describe("Minimum monthly gross salary in EUR"),
          locationSlug: z.string().optional(),
          radiusKm: z.number().optional().describe("Search radius in km around locationSlug, defaults to 25"),
        }),
        execute: async (args: SearchJobsArgs) => {
          const result = searchJobs(allJobs, args, vocab);
          trackAssistantEvent("assistant.search_performed", {
            sessionId,
            resultCount: result.count,
            categorySlug: args.categorySlug ?? null,
            seniority: args.seniority ?? [],
            workModel: args.workModel ?? [],
            employmentType: args.employmentType ?? [],
            remoteOnly: args.remoteOnly ?? false,
            minSalary: args.minSalary ?? 0,
            locationSlug: args.locationSlug ?? null,
          });
          return result;
        },
      }),
    },
    stopWhen: isStepCount(3),
  });

  const response = createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });

  if (isNew) {
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=86400; SameSite=Lax`);
  }

  return response;
}
