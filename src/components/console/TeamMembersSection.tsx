"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveTeamMembersAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { CompanyTeamMember } from "@/lib/db/companies";

const fieldClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";

/** Manual Save button, not autosave — this page has never used autosave
 *  (`CompanyProfileForm`'s single submit button), so the four new
 *  rich-profile sections stay consistent with it rather than borrowing the
 *  candidate-profile pages' autosave convention. */
export function TeamMembersSection({ members }: { members: CompanyTeamMember[] }) {
  const t = useTranslations("console");
  const [rows, setRows] = useState(members.map((m) => ({ name: m.name, role: m.role })));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<{ name: string; role: string | null }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) => [...prev, { name: "", role: null }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
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
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2">
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
