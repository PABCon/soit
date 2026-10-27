/** The version of the Terms of Use / Privacy Policy a user is agreeing to
 *  when they check the consent box at registration — stored alongside
 *  `terms_accepted_at` on `candidates`/`employer_users` so acceptance is a
 *  real, defensible record (what exactly did they agree to, and when),
 *  not just a UI checkbox with no trace once the request completes. Bump
 *  this whenever the legal pages' own `lastUpdated` date (messages/*.json,
 *  "legal.lastUpdated") changes materially — there's no re-acceptance flow
 *  for an existing account yet (not asked for), so a version bump alone
 *  doesn't retroactively do anything; it just keeps new acceptances
 *  accurately dated against the text that was actually live when they
 *  agreed to it. */
export const CURRENT_TERMS_VERSION = "2026-10-18";
