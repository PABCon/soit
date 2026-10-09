import type { EmailMessage } from "../types";

export function topEmployerSubscribedEmail(params: {
  to: string;
  companyName: string;
  billingInterval: "month" | "year";
}): EmailMessage {
  const { to, companyName, billingInterval } = params;
  const cadence = billingInterval === "year" ? "annually" : "monthly";

  const text = `Hi ${companyName},

Your Top Employer subscription is now active, billed ${cadence}.

You now have a verified badge, priority placement, API access, free monthly ad bumps, and a richer company profile — all live in your Just IT employer console.

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">You're a Top Employer</h1>
      <p>Hi ${companyName},</p>
      <p>Your Top Employer subscription is now active, billed <strong>${cadence}</strong>.</p>
      <p>You now have a verified badge, priority placement, API access, free monthly ad bumps, and a richer
        company profile — all live in your Just IT employer console.</p>
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: "You're a Top Employer now", html, text };
}
