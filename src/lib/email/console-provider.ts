import type { EmailMessage, EmailProvider } from "./types";

/** §9.1a — logs the full rendered email instead of delivering it. Real
 *  content is generated every time; there's just no sender connected yet.
 *  Look here (server/Vercel logs) to see what would have gone out. */
export class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}
