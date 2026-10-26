-- Real-usage ask: the company cover/banner image always crops at dead
-- center (object-position: 50% 50%), with no way for an employer to shift
-- which part of their own photo actually shows — "I can't adjust it at
-- all." Adds a stored focal point (0-100 on each axis, default 50/50 =
-- today's behaviour, unchanged for every existing company) the console's
-- new drag-to-reposition editor writes; both the public profile page and
-- the console's own live preview read it back as `object-position: {x}%
-- {y}%`.
alter table companies
  add column cover_position_x smallint not null default 50 check (cover_position_x between 0 and 100),
  add column cover_position_y smallint not null default 50 check (cover_position_y between 0 and 100);

-- GRANT is column-additive, not a replace — same gotcha as every prior
-- companies-column migration in this project.
grant select (cover_position_x, cover_position_y) on companies to anon, authenticated;
grant update (cover_position_x, cover_position_y) on companies to authenticated;
