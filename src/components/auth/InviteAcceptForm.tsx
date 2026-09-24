"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const inputClass = "h-9 rounded-lg border border-line bg-white px-3 text-sm disabled:bg-paper disabled:text-muted";
const labelClass = "flex flex-col gap-1 text-sm";

/** Accepting a team invite (§7.2) is a smaller version of AuthForm: the
 *  email is fixed by the invite, no NIF/company fields since the company
 *  already exists. completeRegistration matches the invite by email
 *  regardless of which of these two paths the person takes. */
export function InviteAcceptForm({ email }: { email: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();

  const [mode, setMode] = useState<"login" | "register">("register");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/recruit`,
            data: { last_role: "employer" },
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        if (data.session) {
          const res = await fetch("/api/auth/finish", { method: "POST" });
          const json = await res.json();
          router.push(json.landingPath ?? "/recruit");
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        // Signing in alone never accepted the invite — ensureEmployerProfile
        // finds it by email and attaches it, same mechanism as the same-
        // email dual-role attach flow (§6.4a).
        const res = await fetch("/api/auth/attach-role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "employer" }),
        });
        const json = await res.json();
        router.push(res.ok ? (json.landingPath ?? "/recruit") : "/recruit");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (checkEmail) {
    return <p className="text-sm text-ink">{t("checkEmail")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <label className={labelClass}>
        <span>{t("email")}</span>
        <input type="email" value={email} disabled className={inputClass} />
      </label>

      <label className={labelClass}>
        <span>{t("password")}</span>
        <input
          type="password"
          required
          minLength={6}
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="flex h-9 items-center justify-center gap-2 rounded-lg bg-pine px-3 text-sm font-medium text-white hover:bg-pine/90 disabled:opacity-50"
      >
        {pending && (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {t(pending ? (mode === "register" ? "creatingAccount" : "loggingIn") : mode === "register" ? "createAccount" : "logIn")}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "register" ? "login" : "register")}
        className="text-sm text-muted underline underline-offset-2"
      >
        {mode === "register" ? t("alreadyHaveAccount") : t("needAccount")}
      </button>
    </form>
  );
}
