"use client";

import { useTranslations } from "next-intl";

/**
 * "Live preview pane while editing" (real-usage QA item, Top Employer
 * profile enhancements). Takes the parent form's own in-memory state
 * directly as props — no separate fetch, no save round-trip — so every
 * keystroke in the fields it covers (name, description, logo/cover,
 * about us/how we work/benefits/custom section) shows here immediately.
 *
 * Deliberately scoped to those fields only: team members, testimonials,
 * and the photo/video galleries each manage their own local state in
 * their own section component with their own independent Save button
 * (see TeamMembersSection's own doc comment for why) — lifting all of
 * that into this form just to feed one preview panel would be a much
 * larger refactor of several already-working components for a part of
 * the page that already gets its own instant `revalidatePath` on save.
 * This covers the fields most people actually iterate on repeatedly
 * before getting right.
 */
export function CompanyProfilePreview({
  name,
  description,
  logoUrl,
  coverUrl,
  aboutUs,
  howWeWork,
  benefits,
  customTitle,
  customBody,
}: {
  name: string;
  description: string;
  logoUrl: string | null;
  coverUrl: string | null;
  aboutUs: string;
  howWeWork: string;
  benefits: string;
  customTitle: string;
  customBody: string;
}) {
  const t = useTranslations("console");

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      {coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- live unsaved preview, not an optimizable static asset
        <img src={coverUrl} alt="" className="h-28 w-full object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-12 w-12 rounded-lg border border-line object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-paper text-sm text-muted">
              {name.slice(0, 1).toUpperCase() || "?"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold text-ink">{name || t("previewUntitled")}</p>
            {description && <p className="truncate text-sm text-muted">{description}</p>}
          </div>
        </div>

        {aboutUs && (
          <section className="mt-5">
            <h3 className="font-display text-sm font-semibold text-ink">{t("richProfileAboutUs")}</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{aboutUs}</p>
          </section>
        )}
        {howWeWork && (
          <section className="mt-5">
            <h3 className="font-display text-sm font-semibold text-ink">{t("richProfileHowWeWork")}</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{howWeWork}</p>
          </section>
        )}
        {benefits && (
          <section className="mt-5">
            <h3 className="font-display text-sm font-semibold text-ink">{t("richProfileBenefits")}</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{benefits}</p>
          </section>
        )}
        {customTitle && customBody && (
          <section className="mt-5">
            <h3 className="font-display text-sm font-semibold text-ink">{customTitle}</h3>
            <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-muted">{customBody}</p>
          </section>
        )}

        {!aboutUs && !howWeWork && !benefits && !(customTitle && customBody) && (
          <p className="mt-5 text-sm text-muted">{t("previewEmpty")}</p>
        )}
      </div>
    </div>
  );
}
