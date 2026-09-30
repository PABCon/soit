import { Resend } from "resend";
import type { EmailMessage, EmailProvider } from "./types";

const FROM = "Just IT <noreply@justit.pt>";

/** §9.1 — the real sending domain (justit.pt, verified with Resend: SPF/
 *  DKIM in place, `eu-west-1`). Swapped in for `ConsoleEmailProvider` in
 *  `send.ts` once the domain was live; nothing else about the email
 *  layer changes — every template still just builds an `EmailMessage`. */
export class ResendEmailProvider implements EmailProvider {
  private client: Resend;

  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(`Resend: ${error.name} — ${error.message}`);
  }
}
