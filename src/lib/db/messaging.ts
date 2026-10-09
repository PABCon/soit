import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { newMessageEmail } from "@/lib/email/templates/new-message";

// Direct messaging (§AI Pieces backlog) — one thread shape, two entry
// points: matching outreach (blinded until the candidate's first reply,
// the real justjoin.it "Matchmaking Beta" consent mechanic) and direct
// contact with a candidate who already applied (identity known from the
// start — applying is itself the identification). `candidates` keeps
// its existing zero-employer-read-access policy untouched; these
// functions never select candidate PII except through the same two
// already-established, audited paths — candidate-matches.ts's blinded
// select, or applications.ts's CANDIDATE_DETAIL_SELECT-shaped admin
// fetch — picked per thread based on `identity_unlocked`.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type ThreadRow = {
  id: string;
  company_id: string;
  candidate_id: string;
  job_id: string;
  origin: "application" | "match";
  identity_unlocked: boolean;
};

async function ensureThread(
  supabase: SupabaseClient,
  params: { companyId: string; candidateId: string; jobId: string; origin: "application" | "match"; identityUnlocked: boolean },
): Promise<string> {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("company_id", params.companyId)
    .eq("candidate_id", params.candidateId)
    .eq("job_id", params.jobId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("message_threads")
    .insert({
      company_id: params.companyId,
      candidate_id: params.candidateId,
      job_id: params.jobId,
      origin: params.origin,
      identity_unlocked: params.identityUnlocked,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return created.id;
}

export type StartThreadResult = { ok: true; threadId: string } | { ok: false; reason: "not_an_employer" | "not_found" | "not_paying" };

/** Direct contact with an applicant — identity is already legitimately
 *  known (the same `applications` RLS + admin-client candidate lookup
 *  `getApplicantsForJob` already uses), so the thread starts unlocked. */
export async function getOrCreateThreadForApplicant(applicationId: string, firstMessageBody: string): Promise<StartThreadResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };

  const supabase = await createClient();
  const { data: application } = await supabase
    .from("applications")
    .select("candidate_id, job_id, jobs!inner ( company_id )")
    .eq("id", applicationId)
    .maybeSingle();
  if (!application) return { ok: false, reason: "not_found" };
  const job = application.jobs as unknown as { company_id: string };
  if (job.company_id !== ctx.company.id) return { ok: false, reason: "not_found" };

  const threadId = await ensureThread(supabase, {
    companyId: ctx.company.id,
    candidateId: application.candidate_id,
    jobId: application.job_id,
    origin: "application",
    identityUnlocked: true,
  });
  const sent = await sendMessage(threadId, firstMessageBody);
  if (!sent.ok) return { ok: false, reason: "not_found" };
  return { ok: true, threadId };
}

/** Matching outreach — identity stays blinded until the candidate
 *  replies. Re-verifies paying-customer status at send time, same as
 *  `candidate-matches.ts`'s read gate — matching access shouldn't
 *  outlive a lapsed subscription just because an old match is still on
 *  screen. */
export async function getOrCreateThreadForMatch(candidateId: string, jobId: string, firstMessageBody: string): Promise<StartThreadResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };
  const isPayingCustomer = ctx.company.ad_credits_available > 0 || ctx.company.top_employer_active;
  if (!isPayingCustomer) return { ok: false, reason: "not_paying" };

  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id, company_id").eq("id", jobId).maybeSingle();
  if (!job || job.company_id !== ctx.company.id) return { ok: false, reason: "not_found" };

  const threadId = await ensureThread(supabase, {
    companyId: ctx.company.id,
    candidateId,
    jobId,
    origin: "match",
    identityUnlocked: false,
  });
  const sent = await sendMessage(threadId, firstMessageBody);
  if (!sent.ok) return { ok: false, reason: "not_found" };
  return { ok: true, threadId };
}

export type SendMessageResult = { ok: true } | { ok: false; reason: "forbidden" | "not_found" };

/** The one place `messages` ever gets written, from either side —
 *  resolves the caller's role, applies the unlock flip (candidate's
 *  first reply on a still-blinded match thread), and schedules the
 *  notification email. `identity_unlocked`/`last_message_at` are
 *  updated via the admin client deliberately: neither role has a
 *  column grant for them (see the migration) — this is server-computed
 *  state, not something either party directly controls. */
export async function sendMessage(threadId: string, body: string): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, company_id, candidate_id, job_id, origin, identity_unlocked")
    .eq("id", threadId)
    .maybeSingle();
  // RLS already hides threads that aren't the caller's — a miss here
  // means "not mine" or "doesn't exist," same response either way.
  if (!thread) return { ok: false, reason: "not_found" };
  const row = thread as ThreadRow;

  const [employerCtx, { data: candidateId }] = await Promise.all([
    getMyEmployerContext(),
    supabase.rpc("my_candidate_id"),
  ]);
  const isEmployer = !!employerCtx && employerCtx.company.id === row.company_id;
  const isCandidate = !!candidateId && candidateId === row.candidate_id;
  if (!isEmployer && !isCandidate) return { ok: false, reason: "forbidden" };
  const senderType: "employer" | "candidate" = isEmployer ? "employer" : "candidate";

  const { error: insertError } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_type: senderType,
    body: trimmed,
  });
  if (insertError) return { ok: false, reason: "forbidden" };

  const willUnlock = senderType === "candidate" && row.origin === "match" && !row.identity_unlocked;
  const admin = createAdminClient();
  await admin
    .from("message_threads")
    .update({ last_message_at: new Date().toISOString(), ...(willUnlock ? { identity_unlocked: true } : {}) })
    .eq("id", threadId);

  await logEvent("message.sent", { thread_id: threadId, sender_type: senderType });
  if (willUnlock) await logEvent("thread.identity_unlocked", { thread_id: threadId });

  scheduleMessageNotification({ thread: row, senderType });
  return { ok: true };
}

function scheduleMessageNotification(params: { thread: ThreadRow; senderType: "employer" | "candidate" }) {
  try {
    after(() => notifyNewMessage(params));
  } catch {
    void notifyNewMessage(params);
  }
}

async function notifyNewMessage({ thread, senderType }: { thread: ThreadRow; senderType: "employer" | "candidate" }) {
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("title").eq("id", thread.job_id).single();
  const jobTitle = job?.title ?? "";

  if (senderType === "employer") {
    const [{ data: candidate }, { data: company }] = await Promise.all([
      admin.from("candidates").select("email, auth_user_id").eq("id", thread.candidate_id).single(),
      admin.from("companies").select("company_name").eq("id", thread.company_id).single(),
    ]);
    if (candidate?.email) {
      // A guest candidate (identified via an application, never an
      // account) can't open /messages — there's nothing to log into. Same
      // register-and-reattach-by-email mechanism as the application
      // confirmation email.
      const registerUrl = candidate.auth_user_id
        ? null
        : `${SITE}/pt/candidate/register?email=${encodeURIComponent(candidate.email)}`;
      await sendEmail(
        newMessageEmail({
          to: candidate.email,
          recipientRole: "candidate",
          otherPartyLabel: company?.company_name ?? "An employer",
          jobTitle,
          inboxUrl: `${SITE}/pt/messages`,
          registerUrl,
        }),
      );
    }
  } else {
    const { data: members } = await admin.from("employer_users").select("auth_user_id").eq("company_id", thread.company_id);
    await Promise.all(
      (members ?? []).map(async (m) => {
        const { data } = await admin.auth.admin.getUserById(m.auth_user_id);
        if (!data.user?.email) return;
        await sendEmail(
          newMessageEmail({
            to: data.user.email,
            recipientRole: "employer",
            otherPartyLabel: "A candidate",
            jobTitle,
            inboxUrl: `${SITE}/pt/recruit/messages`,
            registerUrl: null,
          }),
        );
      }),
    );
  }
}

export type EmployerThreadSummary = {
  threadId: string;
  jobId: string;
  jobTitle: string;
  origin: "application" | "match";
  identityUnlocked: boolean;
  /** null when still blinded — the page renders the anonymous label. */
  candidateName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unread: boolean;
};

export async function getMyThreadsAsEmployer(): Promise<EmployerThreadSummary[]> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("message_threads")
    .select("id, job_id, origin, identity_unlocked, candidate_id, employer_last_read_at, last_message_at, jobs!inner ( title )")
    .eq("company_id", ctx.company.id)
    .order("last_message_at", { ascending: false });
  if (!data) return [];

  const admin = createAdminClient();
  return Promise.all(
    data.map(async (row) => {
      const job = row.jobs as unknown as { title: string };
      let candidateName: string | null = null;
      if (row.identity_unlocked) {
        const { data: candidate } = await admin.from("candidates").select("full_name").eq("id", row.candidate_id).single();
        candidateName = candidate?.full_name ?? null;
      }
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("body")
        .eq("thread_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        threadId: row.id,
        jobId: row.job_id,
        jobTitle: job.title,
        origin: row.origin,
        identityUnlocked: row.identity_unlocked,
        candidateName,
        lastMessagePreview: lastMessage?.body ?? null,
        lastMessageAt: row.last_message_at,
        unread: !row.employer_last_read_at || row.last_message_at > row.employer_last_read_at,
      };
    }),
  );
}

export async function getMyEmployerUnreadThreadCount(): Promise<number> {
  const threads = await getMyThreadsAsEmployer();
  return threads.filter((t) => t.unread).length;
}

export type CandidateThreadSummary = {
  threadId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  lastMessagePreview: string | null;
  lastMessageAt: string;
  unread: boolean;
};

/** Never blinded — a candidate always knows exactly which real company/
 *  job is messaging them. Only the employer's view of the candidate is
 *  conditional. */
export async function getMyThreadsAsCandidate(): Promise<CandidateThreadSummary[]> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return [];

  const { data } = await supabase
    .from("message_threads")
    .select("id, job_id, candidate_last_read_at, last_message_at, jobs!inner ( title, companies!inner ( company_name ) )")
    .eq("candidate_id", candidateId)
    .order("last_message_at", { ascending: false });
  if (!data) return [];

  return Promise.all(
    data.map(async (row) => {
      const job = row.jobs as unknown as { title: string; companies: { company_name: string } };
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("body")
        .eq("thread_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        threadId: row.id,
        jobId: row.job_id,
        jobTitle: job.title,
        companyName: job.companies.company_name,
        lastMessagePreview: lastMessage?.body ?? null,
        lastMessageAt: row.last_message_at,
        unread: !row.candidate_last_read_at || row.last_message_at > row.candidate_last_read_at,
      };
    }),
  );
}

export async function getMyCandidateUnreadThreadCount(): Promise<number> {
  const threads = await getMyThreadsAsCandidate();
  return threads.filter((t) => t.unread).length;
}

export type ThreadMessage = { id: string; senderType: "employer" | "candidate"; body: string; createdAt: string };

export type ThreadDetailResult =
  | {
      ok: true;
      role: "employer" | "candidate";
      jobTitle: string;
      origin: "application" | "match";
      identityUnlocked: boolean;
      candidateName: string | null;
      companyName: string;
      messages: ThreadMessage[];
    }
  | { ok: false; reason: "not_found" };

export async function getThreadDetail(threadId: string): Promise<ThreadDetailResult> {
  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("message_threads")
    .select(
      "id, company_id, candidate_id, origin, identity_unlocked, jobs!inner ( title, companies!inner ( company_name ) )",
    )
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { ok: false, reason: "not_found" };
  const job = thread.jobs as unknown as { title: string; companies: { company_name: string } };

  const [employerCtx, { data: candidateId }] = await Promise.all([
    getMyEmployerContext(),
    supabase.rpc("my_candidate_id"),
  ]);
  const isEmployer = !!employerCtx && employerCtx.company.id === thread.company_id;
  const isCandidate = !!candidateId && candidateId === thread.candidate_id;
  if (!isEmployer && !isCandidate) return { ok: false, reason: "not_found" };

  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, sender_type, body, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  let candidateName: string | null = null;
  if (isEmployer && thread.identity_unlocked) {
    const admin = createAdminClient();
    const { data: candidate } = await admin.from("candidates").select("full_name").eq("id", thread.candidate_id).single();
    candidateName = candidate?.full_name ?? null;
  }

  const readColumn = isEmployer ? "employer_last_read_at" : "candidate_last_read_at";
  await supabase.from("message_threads").update({ [readColumn]: new Date().toISOString() }).eq("id", threadId);

  return {
    ok: true,
    role: isEmployer ? "employer" : "candidate",
    jobTitle: job.title,
    origin: thread.origin,
    identityUnlocked: thread.identity_unlocked,
    candidateName,
    companyName: job.companies.company_name,
    messages: (messageRows ?? []).map((m) => ({ id: m.id, senderType: m.sender_type, body: m.body, createdAt: m.created_at })),
  };
}
