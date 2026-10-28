import { timingSafeEqual } from "node:crypto";

/**
 * Security audit finding: every cron route compared
 * `Authorization: Bearer $CRON_SECRET` with `!==` — not constant-time
 * (a theoretical timing side-channel, low real-world risk over normal
 * network jitter, but a real gap regardless), and with no guard against
 * `CRON_SECRET` being unset: if it were ever empty/undefined in the live
 * environment, the header literally becomes the string `"Bearer
 * undefined"`, and a request carrying that exact header would pass. This
 * is the one place that check now lives, shared by all three cron routes.
 */
export function verifyCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
