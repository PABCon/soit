"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClassName } from "@/components/Button";
import { requestInterviewPrepAction } from "@/app/[locale]/(candidate)/preparacao-entrevista/actions";

const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

const inputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

/**
 * Deliberately simple per direct instruction: no real-time calendar/
 * payment integration — a request goes into the DB and triggers a
 * notification email; a human replies directly to the candidate to
 * actually confirm the slot. `minDate` is computed server-side
 * (minBookableDate()) and passed down so the picker's own `min` always
 * matches the real 2-day-minimum rule instead of a second, hand-copied
 * calculation that could drift from it.
 */
export function InterviewPrepBooking({ minDate }: { minDate: string }) {
  const t = useTranslations("interviewPrep");
  const [date, setDate] = useState("");
  const [time, setTime] = useState(TIME_SLOTS[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) {
      setError(t("error.missing_date"));
      return;
    }
    setBusy(true);
    setError(null);
    const result = await requestInterviewPrepAction(date, time, note);
    setBusy(false);
    if (!result.ok) {
      setError(t(`error.${result.reason}`));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-line bg-paper p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mint/25 text-2xl text-pine">✓</div>
        <h2 className="mt-4 font-display text-lg font-bold text-ink">{t("doneTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("doneBody")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-paper p-6">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          <span>{t("dateLabel")}</span>
          <input type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        </label>

        <label className={labelClass}>
          <span>{t("timeLabel")}</span>
          <select value={time} onChange={(e) => setTime(e.target.value)} className={inputClass}>
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {slot}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={labelClass}>
        <span>{t("noteLabel")}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("notePlaceholder")}
          className="rounded-lg border border-line bg-white p-3 text-sm"
        />
      </label>

      <p className="text-xs text-muted">{t("leadTimeHint")}</p>

      <button type="submit" disabled={busy} className={buttonClassName({ size: "lg" })}>
        {busy ? t("submitting") : t("submitCta")}
      </button>
    </form>
  );
}
