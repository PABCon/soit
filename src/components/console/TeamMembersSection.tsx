"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveTeamMembersAction, uploadTeamMemberPhotoAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { CompanyTeamMember } from "@/lib/db/companies";

const fieldClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";

/** Manual Save button, not autosave — this page has never used autosave
 *  (`CompanyProfileForm`'s single submit button), so the four new
 *  rich-profile sections stay consistent with it rather than borrowing the
 *  candidate-profile pages' autosave convention.
 *
 *  Photo upload (real-usage QA item: "team photos") is itself an
 *  exception to that rule — it uploads immediately on file choice (there's
 *  nothing meaningful to "preview before saving" for an image, unlike
 *  text fields) and holds the returned URL in this row's own local state;
 *  it only actually lands in the database on the next Save click, same as
 *  every other field here. */
export function TeamMembersSection({ members }: { members: CompanyTeamMember[] }) {
  const t = useTranslations("console");
  const [rows, setRows] = useState(members.map((m) => ({ name: m.name, role: m.role, photoUrl: m.photoUrl })));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function update(i: number, patch: Partial<{ name: string; role: string | null; photoUrl: string | null }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) => [...prev, { name: "", role: null, photoUrl: null }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handlePhotoChange(i: number, file: File | null) {
    if (!file) return;
    setPhotoError(null);
    setUploadingIndex(i);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadTeamMemberPhotoAction(formData);
    setUploadingIndex(null);
    if (!result.ok) {
      setPhotoError(t(`teamPhotoError.${result.reason}`));
      return;
    }
    update(i, { photoUrl: result.url });
  }

  async function handleSave() {
    setPending(true);
    setSaved(false);
    await saveTeamMembersAction(rows);
    setPending(false);
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("richProfileTeam")}</span>
        <button type="button" onClick={add} className="text-xs font-medium text-pine hover:underline">
          {t("richProfileAddTeamMember")}
        </button>
      </div>
      {photoError && <p className="text-xs text-red-700">{photoError}</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2">
            <label className="relative shrink-0 cursor-pointer">
              {r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- Supabase Storage URL
                <img src={r.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-paper text-xs text-muted">
                  {r.name.slice(0, 1).toUpperCase() || "?"}
                </span>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="absolute inset-0 h-9 w-9 cursor-pointer opacity-0"
                onChange={(e) => handlePhotoChange(i, e.target.files?.[0] ?? null)}
              />
              {uploadingIndex === i && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[9px] text-white">
                  …
                </span>
              )}
            </label>
            <input
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
              placeholder={t("richProfileTeamName")}
              className={`${fieldClass} flex-1`}
            />
            <input
              value={r.role ?? ""}
              onChange={(e) => update(i, { role: e.target.value || null })}
              placeholder={t("richProfileTeamRole")}
              className={`${fieldClass} flex-1`}
            />
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-700">
              {t("richProfileRemove")}
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="h-9 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {t("save")}
        </button>
        {saved && <span className="text-sm text-pine">{t("saved")}</span>}
      </div>
    </div>
  );
}
