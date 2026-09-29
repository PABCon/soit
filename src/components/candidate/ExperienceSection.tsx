"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveCandidateExperienceAction } from "@/app/[locale]/(candidate)/profile/actions";
import { useAutosave } from "@/hooks/useAutosave";
import type { CandidateExperienceEntry } from "@/lib/db/candidate-profile";

type DraftExperience = {
  title: string;
  company: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  highlights: string[];
};

const fieldClass = "h-8 rounded border border-line bg-white px-2 text-xs";

/** §AI Pieces backlog, profile-depth phase — work history was previously
 *  captured only as a single derived `years_experience` number; this is a
 *  real, always-editable list, ordered newest-first via the entries
 *  array's own initial order (from `getMyCandidateExperience`'s
 *  `start_date desc` query) rather than re-sorting client-side after
 *  edits. Autosaves the whole array ~800ms after any change (real-usage
 *  feedback: an explicit Save button per section was too much friction).
 *  Responsibilities/achievements are a real `highlights` list — each its
 *  own row with a visible bullet marker, not a textarea of "- "-prefixed
 *  lines — so editing actually looks like the bulleted list it is, and a
 *  future CV export can render straight off the array. */
export function ExperienceSection({
  experience,
  seededFromDraft = false,
}: {
  experience: CandidateExperienceEntry[];
  /** True when this mount's initial `experience` came from a freshly-
   *  parsed AI draft, not the persisted baseline — the autosave hook
   *  must not skip that first render, or an unedited draft the
   *  candidate is happy with would silently never get saved. */
  seededFromDraft?: boolean;
}) {
  const t = useTranslations("experience");
  const [entries, setEntries] = useState<DraftExperience[]>(
    experience.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
      highlights: e.highlights,
    })),
  );

  const status = useAutosave(
    entries,
    (value) => saveCandidateExperienceAction(value.filter((e) => e.title.trim() && e.company.trim())),
    800,
    { skipFirstRun: !seededFromDraft },
  );

  function update(i: number, patch: Partial<DraftExperience>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  }
  function add() {
    setEntries((prev) => [
      { title: "", company: "", location: null, startDate: null, endDate: null, description: null, highlights: [] },
      ...prev,
    ]);
  }
  function remove(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateHighlight(i: number, hIndex: number, text: string) {
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, highlights: e.highlights.map((h, hi) => (hi === hIndex ? text : h)) } : e)),
    );
  }
  function addHighlight(i: number) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, highlights: [...e.highlights, ""] } : e)));
  }
  function removeHighlight(i: number, hIndex: number) {
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, highlights: e.highlights.filter((_, hi) => hi !== hIndex) } : e)),
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("workExperience")}</span>
        <div className="flex items-center gap-3">
          {status === "pending" || status === "saving" ? (
            <span className="text-xs text-muted">{t("saving")}</span>
          ) : status === "saved" ? (
            <span className="text-xs text-pine">{t("saved")}</span>
          ) : null}
          <button type="button" onClick={add} className="text-xs font-medium text-pine hover:underline">
            {t("addExperience")}
          </button>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {entries.map((e, i) => (
          <li key={i} className="rounded-lg border border-line bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <input
                value={e.title}
                onChange={(ev) => update(i, { title: ev.target.value })}
                placeholder={t("jobTitle")}
                className={fieldClass}
              />
              <input
                value={e.company}
                onChange={(ev) => update(i, { company: ev.target.value })}
                placeholder={t("company")}
                className={fieldClass}
              />
              <input
                value={e.location ?? ""}
                onChange={(ev) => update(i, { location: ev.target.value || null })}
                placeholder={t("location")}
                className={fieldClass}
              />
              <div />
              <label className="flex flex-col gap-0.5 text-[11px] text-muted">
                {t("startDate")}
                <input
                  type="date"
                  value={e.startDate ?? ""}
                  onChange={(ev) => update(i, { startDate: ev.target.value || null })}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-0.5 text-[11px] text-muted">
                {t("endDate")}
                <input
                  type="date"
                  value={e.endDate ?? ""}
                  onChange={(ev) => update(i, { endDate: ev.target.value || null })}
                  className={fieldClass}
                />
              </label>
            </div>
            <textarea
              value={e.description ?? ""}
              onChange={(ev) => update(i, { description: ev.target.value || null })}
              placeholder={t("description")}
              rows={2}
              className="mt-2 w-full rounded border border-line bg-white px-2 py-1.5 text-xs"
            />

            <div className="mt-2">
              <span className="text-[11px] font-medium text-muted">{t("highlights")}</span>
              <ul className="mt-1 flex flex-col gap-1">
                {e.highlights.map((h, hi) => (
                  <li key={hi} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-muted">
                      •
                    </span>
                    <input
                      value={h}
                      onChange={(ev) => updateHighlight(i, hi, ev.target.value)}
                      placeholder={t("highlightPlaceholder")}
                      className={`${fieldClass} flex-1`}
                    />
                    <button type="button" onClick={() => removeHighlight(i, hi)} className="text-xs text-red-700">
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => addHighlight(i)}
                className="mt-1 text-xs font-medium text-pine hover:underline"
              >
                {t("addHighlight")}
              </button>
            </div>

            <button type="button" onClick={() => remove(i)} className="mt-2 block text-xs text-red-700">
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
