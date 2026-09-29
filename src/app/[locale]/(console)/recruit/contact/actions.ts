"use server";

import { sendEmail } from "@/lib/email/send";
import { contactMessageEmail } from "@/lib/email/templates/contact-message";

// A real inbox once the domain is live — see docs/go-live-checklist.md.
// Harmless as a placeholder today: sendEmail() only ever logs (no real
// provider connected yet), never actually delivers anywhere.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || "hello@justit.pt";

export type SendContactMessageResult = { ok: true } | { ok: false; reason: "invalid_input" };

export async function sendContactMessageAction(input: {
  name: string;
  email: string;
  message: string;
}): Promise<SendContactMessageResult> {
  const name = input.name.trim();
  const email = input.email.trim();
  const message = input.message.trim();
  if (!name || !email || !message) return { ok: false, reason: "invalid_input" };

  await sendEmail(contactMessageEmail({ to: CONTACT_EMAIL, fromName: name, fromEmail: email, message }));
  return { ok: true };
}
