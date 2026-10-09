import type { EmailMessage } from "../types";

export function adCreditsPurchasedEmail(params: {
  to: string;
  companyName: string;
  quantity: number;
  totalCents: number;
  currency: string;
}): EmailMessage {
  const { to, companyName, quantity, totalCents, currency } = params;
  const amount = (totalCents / 100).toLocaleString("en-IE", { style: "currency", currency: currency.toUpperCase() });
  const creditWord = quantity === 1 ? "job ad credit" : "job ad credits";

  const text = `Hi ${companyName},

Your payment of ${amount} for ${quantity} ${creditWord} was successful.

These credits are now available in your Just IT employer console whenever you're ready to publish a job.

— Just IT`;

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #0C6B58;">Payment received</h1>
      <p>Hi ${companyName},</p>
      <p>Your payment of <strong>${amount}</strong> for <strong>${quantity} ${creditWord}</strong> was successful.</p>
      <p>These credits are now available in your Just IT employer console whenever you're ready to publish a job.</p>
      <p style="color: #5b6b66; font-size: 12px;">— Just IT</p>
    </div>
  `.trim();

  return { to, subject: `Payment confirmed — ${quantity} ${creditWord}`, html, text };
}
