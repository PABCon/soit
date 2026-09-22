export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

/** §9.1a — the interface a real provider (Resend, Postmark, …) implements
 *  later. Swapping providers is a one-line change in send.ts, not a
 *  redesign. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
