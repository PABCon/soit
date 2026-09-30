"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { uploadGalleryPhotoAction, removeGalleryPhotoAction } from "@/app/[locale]/(console)/recruit/company/actions";
import type { CompanyGalleryPhoto } from "@/lib/db/companies";

/** Each add is an immediate upload, not queued for a batch save — unlike
 *  the other three sections, there's no local draft array to submit. */
export function PhotoGallerySection({ photos }: { photos: CompanyGalleryPhoto[] }) {
  const t = useTranslations("console");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadGalleryPhotoAction(formData);
    setUploading(false);
    if (!result.ok) {
      setError(t(`imageError.${result.reason}`));
      return;
    }
    window.location.reload();
  }

  async function handleRemove(photoId: string) {
    await removeGalleryPhotoAction(photoId);
    window.location.reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{t("richProfilePhotoGallery")}</span>
        <label className="cursor-pointer text-xs font-medium text-pine hover:underline">
          {uploading ? t("saving") : t("richProfileUploadPhoto")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          />
        </label>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleRemove(p.id)}
                className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
