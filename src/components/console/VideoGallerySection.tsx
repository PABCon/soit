"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { saveGalleryVideosAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { CompanyGalleryVideo } from "@/lib/db/companies";

const fieldClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";

/** Plain external links (title + URL), not an embedded player — a
 *  deliberate v1 scope cut to avoid new CSP/URL-parsing surface. */
export function VideoGallerySection({ videos }: { videos: CompanyGalleryVideo[] }) {
  const t = useTranslations("console");
  const [rows, setRows] = useState(videos.map((v) => ({ title: v.title, url: v.url })));
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(i: number, patch: Partial<{ title: string; url: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function add() {
    setRows((prev) => [...prev, { title: "", url: "" }]);
  }
  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setPending(true);
    setSaved(false);
    await saveGalleryVideosAction(rows);
    setPending(false);
    setSaved(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("richProfileVideoGallery")}</span>
        <button type="button" onClick={add} className="text-xs font-medium text-pine hover:underline">
          {t("richProfileAddVideo")}
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-2">
            <input
              value={r.title}
              onChange={(e) => update(i, { title: e.target.value })}
              placeholder={t("richProfileVideoTitle")}
              className={`${fieldClass} flex-1`}
            />
            <input
              type="url"
              value={r.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder={t("richProfileVideoUrl")}
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
