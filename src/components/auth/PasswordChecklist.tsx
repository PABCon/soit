import { useTranslations } from "next-intl";
import { checkPasswordRequirements, type PasswordRequirementKey } from "@/lib/password";

const ORDER: PasswordRequirementKey[] = ["length", "lowercase", "uppercase", "digit"];

/** Live checklist (real-usage QA item) — updates on every keystroke so a
 *  weak password is obvious before submit, rather than a wall of
 *  requirements text or a rejection only discovered after hitting
 *  submit. Shared between registration and password-change, since both
 *  set a new password against the exact same server-side policy. */
export function PasswordChecklist({ password }: { password: string }) {
  const t = useTranslations("auth");
  const checks = checkPasswordRequirements(password);

  return (
    <ul className="flex flex-col gap-0.5 text-xs">
      {ORDER.map((key) => (
        <li key={key} className={`flex items-center gap-1.5 ${checks[key] ? "text-pine" : "text-muted"}`}>
          <span aria-hidden>{checks[key] ? "✓" : "○"}</span>
          {t(`passwordRequirement.${key}`)}
        </li>
      ))}
    </ul>
  );
}
