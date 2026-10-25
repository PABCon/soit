/** Single source of truth for building a link inside an email — every
 *  template used to redefine this exact fallback independently (7 copies),
 *  which is how a one-off script run locally (`.env.local`'s
 *  NEXT_PUBLIC_SITE_URL is deliberately "http://localhost:3000", correct
 *  for local dev) once sent a real customer a localhost link: nothing
 *  caught it, because there was no single place to add that check. Keeping
 *  the localhost fallback here (removing it would break composing/
 *  previewing email content during local dev) — the actual guard against
 *  sending it for real lives in `send.ts`, the one place every email
 *  actually dispatches through regardless of which template built it. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
