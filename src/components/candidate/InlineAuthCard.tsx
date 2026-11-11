"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { passwordMeetsRequirements } from "@/lib/password";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";
import { PasswordChecklist } from "@/components/auth/PasswordChecklist";

type Mode = "signup" | "login";
type Status = "idle" | "check_email" | "logged_in";

/**
 * A compact, candidate-only email+password card rendered inline in the
 * chat when `previewApply` (or any future account-gated tool) reports
 * `needs_account`, not a persistent header widget, not model-
 * triggered. This is the one hard security boundary in the whole
 * round: the password field here is a real `type="password"` input
 * submitted directly to `supabase.auth.signUp`/`signInWithPassword`
 * from the browser, the exact same calls `AuthForm.tsx` makes for the
 * real registration/login pages. It never goes through `sendMessage`,
 * is never a tool argument, and is never visible to the model or
 * logged anywhere a chat transcript is.
 *
 * Deliberately NOT a trimmed-down `AuthForm`: that component also
 * carries OAuth buttons, employer/NIF fields, and a full-page layout,
 * none of which belong inline in a chat bubble for a candidate-only
 * surface. This reuses only the pieces that matter here, the same
 * password-strength validation (`src/lib/password.ts`) and live
 * checklist (`PasswordChecklist`), the same terms-consent copy/i18n
 * keys, and the identical Supabase Auth calls, not a second,
 * independently-drifting implementation of registration.
 *
 * Signup still requires clicking the real confirmation email (the
 * existing PKCE flow is unchanged, and bypassing it would be a real
 * security regression); there is no way to apply in the same breath
 * as creating the account. Login, which needs no confirmation step,
 * lets the conversation continue immediately: the candidate's next
 * message naturally carries the new session cookie into the next tool
 * call.
 */
export function InlineAuthCard() {
  const t = useTranslations("auth");
  const ta = useTranslations("assistant");
  const locale = useLocale();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const supabase = createClient();

    if (mode === "signup") {
      if (!passwordMeetsRequirements(password)) {
        setError(t("passwordRequirementsNotMet"));
        setPending(false);
        return;
      }
      if (!termsAccepted) {
        setError(t("termsRequired"));
        setPending(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/${locale}/assistant`,
          data: {
            last_role: "candidate",
            pending_terms_accepted_at: new Date().toISOString(),
            pending_terms_version: CURRENT_TERMS_VERSION,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setPending(false);
        return;
      }

      // Same enumeration-safe signal AuthForm.tsx already handles: this
      // email already has a confirmed account. The full dual-role
      // attach flow there needs NIF/company fields that don't belong
      // in this candidate-only inline card, so the honest, scoped
      // response here is just pointing at login instead, not
      // attempting a shortcut that could silently do the wrong thing.
      if (data.user && data.user.identities?.length === 0) {
        setError(t("emailAlreadyRegistered"));
        setMode("login");
        setPending(false);
        return;
      }

      setStatus("check_email");
      setPending(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setPending(false);
      return;
    }
    setStatus("logged_in");
    setPending(false);
  }

  if (status === "check_email") {
    return <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink">{t("checkEmail")}</p>;
  }

  if (status === "logged_in") {
    return <p className="rounded-xl border border-line bg-white p-4 text-sm text-ink">{ta("authCardLoggedIn")}</p>;
  }

  return (
    <div className="max-w-sm rounded-xl border border-line bg-white p-4">
      <div className="mb-3 flex gap-1 rounded-lg bg-paper p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-1.5 ${mode === "signup" ? "bg-white text-pine shadow-sm" : "text-muted"}`}
        >
          {t("createAccount")}
        </button>
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 ${mode === "login" ? "bg-white text-pine shadow-sm" : "text-muted"}`}
        >
          {t("logIn")}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>{t("email")}</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          <span>{t("password")}</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={mode === "signup" ? 8 : undefined}
            className="h-10 rounded-lg border border-line bg-white px-3 text-sm text-ink"
          />
        </label>
        {mode === "signup" && password.length > 0 && <PasswordChecklist password={password} />}

        {mode === "signup" && (
          <label className="flex items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              required
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t("termsConsent")}{" "}
              <Link href="/terms" target="_blank" className="underline hover:text-ink">
                {t("termsLink")}
              </Link>{" "}
              {t("and")}{" "}
              <Link href="/privacy" target="_blank" className="underline hover:text-ink">
                {t("privacyPolicyLink")}
              </Link>
              .
            </span>
          </label>
        )}

        {error && <p className="text-xs text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-lg bg-pine text-sm font-medium text-white hover:bg-pine-hover disabled:opacity-50"
        >
          {mode === "signup" ? (pending ? t("creatingAccount") : t("createAccount")) : pending ? t("loggingIn") : t("logIn")}
        </button>
      </form>
    </div>
  );
}
