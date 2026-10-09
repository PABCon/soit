/** Mirrors the live Supabase Auth project's password policy exactly
 *  (`password_min_length: 8`, `password_required_characters:
 *  "lower_upper_letters_digits"`, applied via the Management API —
 *  see supabase/config.toml) so the client can reject a weak password
 *  before ever hitting the network, same principle as NIF validation.
 *  Used both to gate submission and to drive the live checklist UI. */
export type PasswordRequirementKey = "length" | "lowercase" | "uppercase" | "digit";

export function checkPasswordRequirements(password: string): Record<PasswordRequirementKey, boolean> {
  return {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };
}

export function passwordMeetsRequirements(password: string): boolean {
  const checks = checkPasswordRequirements(password);
  return checks.length && checks.lowercase && checks.uppercase && checks.digit;
}
