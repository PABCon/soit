"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveCandidateExperienceAction } from "@/app/[locale]/(candidate)/profile/actions";
import type { CandidateExperienceEntry } from "@/lib/db/candidate-profile";

type DraftExperience = {
  title: string;
  company: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
};

const fieldClass = "h-8 rounded border border-line bg-white px-2 text-xs";

/** §AI Pieces backlog, profile-depth phase — work history was previously
 *  captured only as a single derived `years_experience` number; this is a
 *  real, always-editable list (add/edit/remove, one "Save changes"),
 *  ordered newest-first via the entries array's own initial order (from
 *  `getMyCandidateExperience`'s `start_date desc` query) rather than
 *  re-sorting client-side after edits. */
export function ExperienceSection({ experience }: { experience: CandidateExperienceEntry[] }) {
  const t = useTranslations("experience");
  const [entries, setEntries] = useState<DraftExperience[]>(
    experience.map((e) => ({
      title: e.title,
      company: e.company,
      location: e.location,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
  );
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<DraftExperience>) {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    setSaved(false);
  }
  function add() {
    setEntries((prev) => [
      { title: "", company: "", location: null, startDate: null, endDate: null, description: null },
      ...prev,
    ]);
    setSaved(false);
  }
  function remove(i: number) {
    setEntries((prev) => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  }
  async function save() {
    setPending(true);
    await saveCandidateExperienceAction(entries.filter((e) => e.title.trim() && e.company.trim()));
    setPending(false);
    setSaved(true);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("workExperience")}</span>
        <button type="button" onClick={add} className="text-xs font-medium text-pine hover:underline">
          {t("addExperience")}
        </button>
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
              rows={3}
              className="mt-2 w-full rounded border border-line bg-white px-2 py-1.5 text-xs"
            />
            <button type="button" onClick={() => remove(i)} className="mt-2 text-xs text-red-700">
              {t("remove")}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {pending ? t("saving") : t("saveChanges")}
        </button>
        {saved && <span className="text-sm text-pine">{t("saved")}</span>}
      </div>
    </div>
  );
}
