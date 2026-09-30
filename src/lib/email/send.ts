import type { EmailMessage } from "./types";
import { ResendEmailProvider } from "./resend-provider";

// The one line that changed when the real provider got wired in (§9.1) —
// `justit.pt` is verified with Resend (SPF/DKIM, eu-west-1).
const provider = new ResendEmailProvider(process.env.RESEND_API_KEY!);

/** Never lets a failed/log-only send break the caller's flow — an
 *  application must succeed regardless of what happens to its emails. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await provider.send(message);
  } catch (error) {
    console.error("sendEmail failed:", error);
  }
}
