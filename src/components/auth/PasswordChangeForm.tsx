"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { passwordMeetsRequirements } from "@/lib/password";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";
import { buttonClassName } from "@/components/Button";
import { CardHeading } from "@/components/CardHeading";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm";
const cardInputClass = "h-11 rounded-lg border border-line bg-white px-3 text-sm";
const labelClass = "flex flex-col gap-1 text-sm";

/** Shared between the candidate/employer settings pages and the
 *  reset-password page. Supabase's `updateUser` only needs the live
 *  session — already established by login, or by the recovery-link
 *  exchange on /auth/reset-password — so the current password is never
 *  re-collected. `variant="card"` renders the restyled white-card
 *  presentation (/recruit/settings) with an eye-toggle on each field;
 *  the default keeps the original plain layout (candidate /settings),
 *  left untouched since this component is shared and only one of its
 *  two consumers was asked to restyle this round. */
export function PasswordChangeForm({
  onSuccess,
  variant = "default",
}: {
  onSuccess?: () => void;
  variant?: "default" | "card";
}) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    if (!passwordMeetsRequirements(password)) {
      setError(t("passwordRequirementsNotMet"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPending(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setConfirm("");
    setSaved(true);
    onSuccess?.();
  }

  if (variant === "card") {
    return (
      <div className="rounded-xl border border-line bg-white p-6">
        <CardHeading icon={Lock} title={t("changePassword")} subtitle={t("changePasswordSubtitle")} />

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("newPassword")}</span>
              <span className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${cardInputClass} w-full pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t(showPassword ? "hidePassword" : "showPassword")}
                  className="absolute right-3 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </span>
            </label>
            <label className={labelClass}>
              <span className="font-medium text-ink">{t("confirmPassword")}</span>
              <span className="relative flex items-center">
                <input
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={`${cardInputClass} w-full pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={t(showConfirm ? "hidePassword" : "showPassword")}
                  className="absolute right-3 text-muted hover:text-ink"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </span>
            </label>
          </div>

          <PasswordChecklist password={password} />

          <div className="flex items-center gap-3">
            <button type="submit" disabled={pending} className={buttonClassName({ size: "md" })}>
              {t("savePassword")}
            </button>
            {saved && <span className="text-sm text-pine">{t("passwordSaved")}</span>}
          </div>
        </form>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className={labelClass}>
        <span>{t("newPassword")}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>
      <PasswordChecklist password={password} />
      <label className={labelClass}>
        <span>{t("confirmPassword")}</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-pine px-4 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
        >
          {t("savePassword")}
        </button>
        {saved && !onSuccess && <span className="text-sm text-pine">{t("passwordSaved")}</span>}
      </div>
    </form>
  );
}
