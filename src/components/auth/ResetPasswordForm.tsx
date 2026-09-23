"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PasswordChangeForm } from "@/components/auth/PasswordChangeForm";

/** After a successful reset, lands the user exactly where a normal login
 *  would — same `/api/auth/landing` resolution AuthForm's login path
 *  already uses, no separate "where do I belong" logic. */
export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const router = useRouter();

  async function handleSuccess() {
    const res = await fetch("/api/auth/landing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    router.push(json.landingPath ?? "/jobs");
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("resetPasswordHint")}</p>
      <PasswordChangeForm onSuccess={handleSuccess} />
    </div>
  );
}
