import type { EmailMessage } from "./types";
import { ConsoleEmailProvider } from "./console-provider";

// The one line that changes when a real provider gets wired in.
const provider = new ConsoleEmailProvider();

/** Never lets a failed/log-only send break the caller's flow — an
 *  application must succeed regardless of what happens to its emails. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  try {
    await provider.send(message);
  } catch (error) {
    console.error("sendEmail failed:", error);
  }
}
