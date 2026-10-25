import type { EmailMessage } from "./types";
import { ResendEmailProvider } from "./resend-provider";

// The one line that changed when the real provider got wired in (§9.1) —
// `justit.pt` is verified with Resend (SPF/DKIM, eu-west-1).
const provider = new ResendEmailProvider(process.env.RESEND_API_KEY!);

/** Real incident (2026-10-25): a one-off script run locally sent a real
 *  customer an email whose button pointed at `localhost` — `.env.local`'s
 *  NEXT_PUBLIC_SITE_URL is deliberately `http://localhost:3000` for local
 *  dev, and there was no single place that checked for this before a
 *  message with a live Resend API key (the same account for local and
 *  production — unlike Stripe, there's no sandbox/live split to lean on)
 *  actually went out. This is the one function every email — app code or
 *  a one-off script — dispatches through, so it's the one place a check
 *  here protects all of them at once. Set
 *  `ALLOW_LOCALHOST_EMAIL_LINKS=true` to deliberately send yourself a
 *  local-dev test email with a localhost link; anything else, a localhost
 *  link in a real send is refused rather than silently going out. */
function containsLocalhostLink(message: EmailMessage): boolean {
  return /localhost|127\.0\.0\.1/.test(message.html) || /localhost|127\.0\.0\.1/.test(message.text);
}

/** Never lets a failed/log-only send break the caller's flow — an
 *  application must succeed regardless of what happens to its emails. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (containsLocalhostLink(message) && process.env.ALLOW_LOCALHOST_EMAIL_LINKS !== "true") {
    console.error(
      `sendEmail refused: message to ${message.to} ("${message.subject}") contains a localhost link. ` +
        "Set NEXT_PUBLIC_SITE_URL to the real site before sending for real, or ALLOW_LOCALHOST_EMAIL_LINKS=true to send a deliberate local-dev test anyway.",
    );
    return;
  }

  try {
    await provider.send(message);
  } catch (error) {
    console.error("sendEmail failed:", error);
  }
}
