"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { sendContactMessageAction } from "@/app/[locale]/(console)/recruit/contact/actions";
import { buttonClassName } from "@/components/Button";

const inputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm placeholder:text-muted";
const labelClass = "flex flex-col gap-1.5 text-sm font-medium text-ink";

/** Item 7 (§ real-usage QA, employer-console review), the email half —
 *  the chat half was deliberately skipped for now (2026-09-29: no live
 *  channel yet, revisit later rather than build or embed one now).
 *  Employer-only by your own explicit confirmation (2026-09-29) — this
 *  is why the page lives under (console)/recruit, inheriting that
 *  layout's own auth guard, rather than a universally-reachable route.
 *  Sends through the same EmailProvider interface every other email in
 *  this app already goes through — currently just logs (no real
 *  provider connected), same as application-confirmation/new-applicant. */
export function ContactForm() {
  const t = useTranslations("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const result = await sendContactMessageAction({ name, email, message });
    setPending(false);
    if (!result.ok) {
      setError(t("errorGeneric"));
      return;
    }
    // Reset the form instead of replacing it with a static confirmation —
    // real-usage report: there was no way to send a second message without
    // reloading the page, which also silently discarded the success
    // message the moment you started typing again.
    setName("");
    setEmail("");
    setMessage("");
    setSent(true);
  }

  return (
    <div className="rounded-xl border border-line bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">{t("formHeading")}</h2>
      <p className="mt-1 text-sm text-muted">{t("formSubtitle")}</p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        {sent && <p className="rounded-lg bg-mint/20 px-3 py-2 text-sm text-pine">{t("sentConfirmation")}</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <label className={labelClass}>
          <span>{t("name")}</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span>{t("email")}</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          <span>{t("message")}</span>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("messagePlaceholder")}
            rows={5}
            className={`${inputClass} h-auto py-2`}
          />
        </label>
        <button type="submit" disabled={pending} className={buttonClassName({ size: "lg", className: "w-full" })}>
          {pending ? t("sending") : t("send")}
        </button>
      </form>
    </div>
  );
}
