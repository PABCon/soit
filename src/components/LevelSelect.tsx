"use client";

import { useTranslations } from "next-intl";
import type { SkillLevel } from "@/lib/types";

const LEVELS: SkillLevel[] = ["basic", "intermediate", "advanced", "expert"];

/** Shared `skill_level` picker — reuses `jobForm`'s own `levelOption`/
 *  `levelUnspecified` i18n keys (same enum, same meaning as the job-
 *  requirement side) rather than duplicating the strings. Used by every
 *  candidate-side skill/language editor (`CvAutofillReview`,
 *  `SkillsEducationSection`). */
export function LevelSelect({
  value,
  onChange,
  className,
}: {
  value: SkillLevel | null;
  onChange: (level: SkillLevel | null) => void;
  className?: string;
}) {
  const t = useTranslations("jobForm");
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as SkillLevel | null)}
      className={className ?? "h-7 rounded border border-line bg-white px-1 text-xs"}
    >
      <option value="">{t("levelUnspecified")}</option>
      {LEVELS.map((lv) => (
        <option key={lv} value={lv}>
          {t(`levelOption.${lv}`)}
        </option>
      ))}
    </select>
  );
}
