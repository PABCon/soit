import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { interviewPrepRequestedEmail } from "@/lib/email/templates/interview-prep-requested";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hello@justit.pt";

/** Earliest requestable date, per the explicit rule: no same-day or
 *  next-day requests, only "2 days or more" out. Plain calendar-date
 *  arithmetic (not a strict 48-hour window) — the rule is about which
 *  *days* are off-limits, not an exact hour count, and this project has
 *  no established timezone-handling convention to reach for beyond that.
 *  Exported so the client-side date picker's own `min` can stay in sync
 *  with the real server-side rule instead of a second, hand-copied
 *  calculation that could drift from it. */
export function minBookableDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}

export type RequestInterviewPrepResult =
  | { ok: true }
  | { ok: false; reason: "not_a_candidate" | "too_soon" | "db_error" };

/**
 * The whole feature, deliberately simple per direct instruction: no
 * real-time calendar/payment integration, just a request that goes into
 * the candidate's own `interview_prep_requests` row and a notification
 * email to CONTACT_EMAIL — a human replies to the candidate directly to
 * actually confirm the slot. The 2-day-minimum rule is re-validated here,
 * server-side, never trusted from the client-side date picker alone.
 */
export async function requestInterviewPrep(
  requestedDate: string,
  requestedTime: string,
  note: string | null,
): Promise<RequestInterviewPrepResult> {
  if (requestedDate < minBookableDate()) return { ok: false, reason: "too_soon" };

  const supabase = await createClient();
  const { data: candidateId } = await supabase.rpc("my_candidate_id");
  if (!candidateId) return { ok: false, reason: "not_a_candidate" };

  const { data: candidate } = await supabase.from("candidates").select("full_name, email, phone").eq("id", candidateId).single();
  if (!candidate) return { ok: false, reason: "not_a_candidate" };

  const { error } = await supabase
    .from("interview_prep_requests")
    .insert({ candidate_id: candidateId, requested_date: requestedDate, requested_time: requestedTime, note });
  if (error) return { ok: false, reason: "db_error" };

  // Same non-blocking pattern applications.ts already established for its
  // own notification emails — the candidate shouldn't wait on an email
  // round trip before seeing their confirmation.
  const emailMessage = interviewPrepRequestedEmail({
    to: CONTACT_EMAIL,
    candidateName: candidate.full_name ?? candidate.email,
    candidateEmail: candidate.email,
    candidatePhone: candidate.phone,
    requestedDate,
    requestedTime,
    note,
  });
  try {
    after(() => sendEmail(emailMessage));
  } catch {
    void sendEmail(emailMessage);
  }

  return { ok: true };
}
