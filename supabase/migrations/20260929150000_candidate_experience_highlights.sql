-- Real-usage feedback: work-experience "highlights" (responsibilities/
-- achievements) were stored as "- "-prefixed lines inside one free-text
-- `description` blob. That required every future consumer (this form's
-- own edit UI, a future public profile view, a future CV export) to
-- re-parse dashes out of a string to render real bullets — fragile, and
-- repeated parsing logic wherever it's shown. A real `text[]` column
-- lets every consumer just map over it, and is the right shape for a
-- future CV-export feature to render straight into a real bulleted PDF/
-- HTML without any parsing step. `description` stays as an optional
-- short narrative intro (some CVs write one before the bullets; not
-- every entry has both).

alter table candidate_experience
  add column highlights text[] not null default '{}';
