import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEmployerContext } from "./companies";
import { logEvent } from "@/lib/events";
import { sendEmail } from "@/lib/email/send";
import { newMessageEmail } from "@/lib/email/templates/new-message";
import { connectionResponseEmail } from "@/lib/email/templates/connection-response";
import { sniffAttachmentType } from "@/lib/file-sniff";

// Round 31 — real attachments. Same 5MB cap as the `cvs` bucket (§6.7);
// the private `message-attachments` bucket has no client RLS policies at
// all, same shape as `cvs` — every upload goes through the admin client,
// only after the caller is already confirmed a legitimate party to the
// thread, and every read is a short-lived signed URL minted the same way.
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ATTACHMENT_CONTENT_TYPES: Record<Exclude<ReturnType<typeof sniffAttachmentType>, null>, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

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

type RequestStatus = "pending" | "accepted" | "declined";

type ThreadRow = {
  id: string;
  company_id: string;
  candidate_id: string;
  job_id: string;
  origin: "application" | "match";
  identity_unlocked: boolean;
  request_status: RequestStatus;
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

  // Phase 3: the gate. A brand-new 'match' thread starts 'pending', a
  // real request the candidate must explicitly respond to; 'application'
  // threads start (and stay) 'accepted', since identity there is already
  // known from the application itself, so there's nothing to gate.
  const { data: created, error } = await supabase
    .from("message_threads")
    .insert({
      company_id: params.companyId,
      candidate_id: params.candidateId,
      job_id: params.jobId,
      origin: params.origin,
      identity_unlocked: params.identityUnlocked,
      request_status: params.origin === "match" ? "pending" : "accepted",
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

/** Bug fix (`/recruit/applicants` restyle): "Message" must open the real
 *  thread page immediately, not a small inline compose box first. This
 *  is `getOrCreateThreadForApplicant` minus the forced first
 *  `sendMessage()` call — find-or-create the thread and hand back its id
 *  so the caller can navigate straight to `/recruit/messages/[threadId]`,
 *  where the real `ThreadComposer` already handles an empty, brand-new
 *  thread correctly. */
export async function getOrCreateThreadIdForApplicant(applicationId: string): Promise<StartThreadResult> {
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
  return { ok: true, threadId };
}

export type ExistingMatchThread = { threadId: string; requestStatus: RequestStatus } | null;

/** Phase 3. The matchmaking candidate page needs to know, before
 *  rendering anything, whether a connection request was already sent for
 *  this exact candidate+job: once sent, it's a one-shot ask (the
 *  employer can't just keep re-triggering `StartThreadButton` to send a
 *  second opening message. `sendMessage`'s own gate already rejects
 *  that server-side, but the UI shouldn't invite the attempt at all). */
export async function getExistingMatchThread(candidateId: string, jobId: string): Promise<ExistingMatchThread> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_threads")
    .select("id, request_status")
    .eq("company_id", ctx.company.id)
    .eq("candidate_id", candidateId)
    .eq("job_id", jobId)
    .eq("origin", "match")
    .maybeSingle();
  return data ? { threadId: data.id, requestStatus: data.request_status } : null;
}

/** Matching outreach — identity stays blinded until the candidate
 *  replies. Re-verifies paying-customer status at send time, same as
 *  `candidate-matches.ts`'s read gate — matching access shouldn't
 *  outlive a lapsed subscription just because an old match is still on
 *  screen. */
export async function getOrCreateThreadForMatch(candidateId: string, jobId: string, firstMessageBody: string): Promise<StartThreadResult> {
  const ctx = await getMyEmployerContext();
  if (!ctx) return { ok: false, reason: "not_an_employer" };
  const isPayingCustomer = ctx.company.job_ad_slot_cap > 1 || ctx.company.top_employer_active;
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

export type SendMessageResult =
  | { ok: true }
  | { ok: false; reason: "forbidden" | "not_found" | "bad_attachment" | "request_pending" | "request_declined" };

type UploadedAttachment = { path: string; filename: string; contentType: string; sizeBytes: number };

/** Uploads via the admin client only — same "no client storage policies
 *  at all" posture as the `cvs` bucket; the caller must already have
 *  passed `sendMessage()`'s own authorization check before this runs.
 *  Content-sniffed by magic bytes (never the declared/extension type),
 *  same discipline `file-sniff.ts` already established for CVs. */
async function uploadMessageAttachment(
  threadId: string,
  file: File,
): Promise<{ ok: true; attachment: UploadedAttachment } | { ok: false }> {
  if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) return { ok: false };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffAttachmentType(bytes);
  if (!kind) return { ok: false };

  const path = `${threadId}/${crypto.randomUUID()}.${kind}`;
  const contentType = ATTACHMENT_CONTENT_TYPES[kind];
  const admin = createAdminClient();
  const { error } = await admin.storage.from("message-attachments").upload(path, bytes, { contentType });
  if (error) return { ok: false };

  return {
    ok: true,
    attachment: { path, filename: file.name, contentType, sizeBytes: file.size },
  };
}

/** The one place `messages` ever gets written, from either side —
 *  resolves the caller's role, applies the unlock flip (candidate's
 *  first reply on a still-blinded match thread), and schedules the
 *  notification email. `identity_unlocked`/`last_message_at` are
 *  updated via the admin client deliberately: neither role has a
 *  column grant for them (see the migration) — this is server-computed
 *  state, not something either party directly controls.
 *
 *  Round 31 — `file` is optional and symmetric for both roles: a
 *  candidate's first reply on a still-blinded match thread can carry an
 *  attachment too, and the upload only ever runs *after* the
 *  authorization check below, so there's no path for an unauthorized
 *  sender (or a party to a thread that isn't theirs) to write a file
 *  into storage before that check has run. */
export async function sendMessage(threadId: string, body: string, file?: File | null): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed && !file) return { ok: false, reason: "forbidden" };

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, company_id, candidate_id, job_id, origin, identity_unlocked, request_status")
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

  // Phase 3: the accept/decline gate. A declined thread is terminal for
  // both sides, permanently (identity never unlocked, nothing further to
  // say). A pending thread blocks the candidate from skipping the
  // explicit Accept/Decline step by just replying, and blocks the
  // employer from sending a second message before the candidate has
  // responded to the first (server-enforced, not just a hidden compose
  // box, the same discipline this project applies to every other
  // client-trust boundary).
  if (row.request_status === "declined") return { ok: false, reason: "request_declined" };
  if (row.request_status === "pending") {
    if (isCandidate) return { ok: false, reason: "request_pending" };
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", threadId);
    if ((count ?? 0) > 0) return { ok: false, reason: "request_pending" };
  }

  let attachment: UploadedAttachment | null = null;
  if (file) {
    const uploaded = await uploadMessageAttachment(threadId, file);
    if (!uploaded.ok) return { ok: false, reason: "bad_attachment" };
    attachment = uploaded.attachment;
  }

  // `messages_body_check` requires non-empty text — an attachment with
  // no typed caption falls back to its own filename rather than needing
  // a schema change to allow true emptiness (see the migration's note).
  const finalBody = trimmed || attachment!.filename;

  const { error: insertError } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_type: senderType,
    body: finalBody,
    attachment_path: attachment?.path ?? null,
    attachment_filename: attachment?.filename ?? null,
    attachment_content_type: attachment?.contentType ?? null,
    attachment_size_bytes: attachment?.sizeBytes ?? null,
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

  scheduleMessageNotification({ thread: row, senderType, messageExcerpt: finalBody });
  return { ok: true };
}

export type RespondToConnectionRequestResult = { ok: true } | { ok: false; reason: "forbidden" | "not_found" | "already_responded" };

/** Phase 3. The candidate's own explicit response to a connection
 *  request. This, not a plain reply, is what unlocks identity on a
 *  'match' thread now: accepting is itself the consent action (no
 *  forced opening reply required, same as a real "accept connection"
 *  interaction elsewhere), and declining never unlocks anything, ever.
 *  The thread becomes terminal, identity stays private regardless of
 *  how the employer might otherwise have learned it. */
export async function respondToConnectionRequest(
  threadId: string,
  decision: "accepted" | "declined",
): Promise<RespondToConnectionRequestResult> {
  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "forbidden" };

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id, company_id, candidate_id, job_id, origin, identity_unlocked, request_status")
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { ok: false, reason: "not_found" };
  const row = thread as ThreadRow;
  if (row.candidate_id !== candidateId || row.origin !== "match") return { ok: false, reason: "not_found" };
  if (row.request_status !== "pending") return { ok: false, reason: "already_responded" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("message_threads")
    .update({
      request_status: decision,
      responded_at: new Date().toISOString(),
      ...(decision === "accepted" ? { identity_unlocked: true } : {}),
    })
    .eq("id", threadId);
  if (error) return { ok: false, reason: "forbidden" };

  await logEvent(decision === "accepted" ? "thread.request_accepted" : "thread.request_declined", { thread_id: threadId });
  scheduleConnectionResponseNotification({ thread: row, decision });
  return { ok: true };
}

function scheduleConnectionResponseNotification(params: { thread: ThreadRow; decision: "accepted" | "declined" }) {
  try {
    after(() => notifyConnectionResponse(params));
  } catch {
    void notifyConnectionResponse(params);
  }
}

/** Employer-only. A candidate always already knows the outcome of their
 *  own decision, nothing to notify them of. Deliberately never names the
 *  candidate even on acceptance (same "A candidate" genericism
 *  `notifyNewMessage` already uses for this direction): the employer
 *  sees the real name the moment they open the now-unlocked thread, this
 *  is just the nudge to go look. */
async function notifyConnectionResponse({ thread, decision }: { thread: ThreadRow; decision: "accepted" | "declined" }) {
  const admin = createAdminClient();
  const { data: job } = await admin.from("jobs").select("title").eq("id", thread.job_id).single();
  const { data: members } = await admin.from("employer_users").select("auth_user_id").eq("company_id", thread.company_id);
  await Promise.all(
    (members ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.auth_user_id);
      if (!data.user?.email) return;
      await sendEmail(
        connectionResponseEmail({
          to: data.user.email,
          decision,
          jobTitle: job?.title ?? "",
          threadUrl: `${SITE}/pt/recruit/messages/${thread.id}`,
        }),
      );
    }),
  );
}

function scheduleMessageNotification(params: {
  thread: ThreadRow;
  senderType: "employer" | "candidate";
  messageExcerpt: string;
}) {
  try {
    after(() => notifyNewMessage(params));
  } catch {
    void notifyNewMessage(params);
  }
}

async function notifyNewMessage({
  thread,
  senderType,
  messageExcerpt,
}: {
  thread: ThreadRow;
  senderType: "employer" | "candidate";
  messageExcerpt: string;
}) {
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
          messageExcerpt,
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
            messageExcerpt,
            registerUrl: null,
          }),
        );
      }),
    );
  }
}

function attachmentPrefixed(body: string, attachmentPath: string | null): string {
  return attachmentPath ? `📎 ${body}` : body;
}

export type EmployerThreadSummary = {
  threadId: string;
  jobId: string;
  jobTitle: string;
  origin: "application" | "match";
  identityUnlocked: boolean;
  requestStatus: RequestStatus;
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
    .select(
      "id, job_id, origin, identity_unlocked, request_status, candidate_id, employer_last_read_at, last_message_at, jobs!inner ( title )",
    )
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
        .select("body, attachment_path")
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
        requestStatus: row.request_status,
        candidateName,
        lastMessagePreview: lastMessage ? attachmentPrefixed(lastMessage.body, lastMessage.attachment_path) : null,
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
  requestStatus: RequestStatus;
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
    .select(
      "id, job_id, request_status, candidate_last_read_at, last_message_at, jobs!inner ( title, companies!inner ( company_name ) )",
    )
    .eq("candidate_id", candidateId)
    .order("last_message_at", { ascending: false });
  if (!data) return [];

  return Promise.all(
    data.map(async (row) => {
      const job = row.jobs as unknown as { title: string; companies: { company_name: string } };
      const { data: lastMessage } = await supabase
        .from("messages")
        .select("body, attachment_path")
        .eq("thread_id", row.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        threadId: row.id,
        jobId: row.job_id,
        jobTitle: job.title,
        companyName: job.companies.company_name,
        requestStatus: row.request_status,
        lastMessagePreview: lastMessage ? attachmentPrefixed(lastMessage.body, lastMessage.attachment_path) : null,
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

export type ThreadMessage = {
  id: string;
  senderType: "employer" | "candidate";
  body: string;
  createdAt: string;
  attachment: { filename: string; contentType: string; sizeBytes: number; signedUrl: string } | null;
};

/** Same 15-minute cap already used for CV signed URLs. */
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 900;

export type ThreadDetailResult =
  | {
      ok: true;
      role: "employer" | "candidate";
      jobId: string;
      jobTitle: string;
      jobSlug: string;
      origin: "application" | "match";
      identityUnlocked: boolean;
      requestStatus: RequestStatus;
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
      "id, company_id, candidate_id, job_id, origin, identity_unlocked, request_status, jobs!inner ( title, slug, companies!inner ( company_name ) )",
    )
    .eq("id", threadId)
    .maybeSingle();
  if (!thread) return { ok: false, reason: "not_found" };
  const job = thread.jobs as unknown as { title: string; slug: string; companies: { company_name: string } };

  const [employerCtx, { data: candidateId }] = await Promise.all([
    getMyEmployerContext(),
    supabase.rpc("my_candidate_id"),
  ]);
  const isEmployer = !!employerCtx && employerCtx.company.id === thread.company_id;
  const isCandidate = !!candidateId && candidateId === thread.candidate_id;
  if (!isEmployer && !isCandidate) return { ok: false, reason: "not_found" };

  const { data: messageRows } = await supabase
    .from("messages")
    .select("id, sender_type, body, created_at, attachment_path, attachment_filename, attachment_content_type, attachment_size_bytes")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });

  // Signed URLs are minted here, after the authorization check above
  // already confirmed the caller is a legitimate party to this thread —
  // same "no client storage policy, sign after the app-code check"
  // posture as the `cvs` bucket's own CV downloads.
  const admin = createAdminClient();
  const messages: ThreadMessage[] = await Promise.all(
    (messageRows ?? []).map(async (m) => {
      let attachment: ThreadMessage["attachment"] = null;
      if (m.attachment_path && m.attachment_filename && m.attachment_content_type && m.attachment_size_bytes !== null) {
        const { data: signed } = await admin.storage
          .from("message-attachments")
          .createSignedUrl(m.attachment_path, ATTACHMENT_SIGNED_URL_TTL_SECONDS);
        attachment = signed
          ? {
              filename: m.attachment_filename,
              contentType: m.attachment_content_type,
              sizeBytes: m.attachment_size_bytes,
              signedUrl: signed.signedUrl,
            }
          : null;
      }
      return { id: m.id, senderType: m.sender_type, body: m.body, createdAt: m.created_at, attachment };
    }),
  );

  let candidateName: string | null = null;
  if (isEmployer && thread.identity_unlocked) {
    const { data: candidate } = await admin.from("candidates").select("full_name").eq("id", thread.candidate_id).single();
    candidateName = candidate?.full_name ?? null;
  }

  // Item-1 latency check: this is a non-critical bookkeeping write (marks
  // the thread read) that was blocking the response on the critical path
  // — same class of bug this project has fixed before via `after()`
  // (`/api/auth/landing`'s `last_role` update, VIES retry scheduling).
  // Deferred the same way; the client already has the messages it needs
  // from the rest of this function.
  const readColumn = isEmployer ? "employer_last_read_at" : "candidate_last_read_at";
  const markRead = () => supabase.from("message_threads").update({ [readColumn]: new Date().toISOString() }).eq("id", threadId);
  try {
    after(markRead);
  } catch {
    void markRead();
  }

  return {
    ok: true,
    role: isEmployer ? "employer" : "candidate",
    jobId: thread.job_id,
    jobTitle: job.title,
    jobSlug: job.slug,
    origin: thread.origin,
    identityUnlocked: thread.identity_unlocked,
    requestStatus: thread.request_status,
    candidateName,
    companyName: job.companies.company_name,
    messages,
  };
}
