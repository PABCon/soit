import { requestInterviewPrep, minBookableDate } from "@/lib/db/interview-prep";

export type RequestInterviewPrepToolResult =
  | { ok: false; reason: "needs_account" }
  | { ok: false; reason: "too_soon"; minDate: string }
  | { ok: false; reason: "db_error" }
  | { ok: true };

/**
 * Thin wrapper translating the real booking function's own
 * `not_a_candidate` reason into the same `needs_account` signal every
 * other candidate-gated chat tool already uses, so the client's
 * existing InlineAuthCard branch covers this tool for free, no new
 * client code. No new auth/validation logic of its own:
 * `requestInterviewPrep()` already resolves identity itself via
 * `my_candidate_id()` and re-validates the 2-day minimum server-side,
 * never trusting the model's own date math. This is a real human-
 * booking request (an email to a person who replies to confirm), not
 * an AI content feature, so there's no preview/confirm dance here the
 * way apply has: asking for a specific future date/time the model
 * can't invent already functions as the natural confirmation gate.
 */
export async function requestInterviewPrepForChat(date: string, time: string, note?: string): Promise<RequestInterviewPrepToolResult> {
  const result = await requestInterviewPrep(date, time, note ?? null);
  if (result.ok) return result;
  if (result.reason === "not_a_candidate") return { ok: false, reason: "needs_account" };
  if (result.reason === "too_soon") return { ok: false, reason: "too_soon", minDate: minBookableDate() };
  return { ok: false, reason: "db_error" };
}
