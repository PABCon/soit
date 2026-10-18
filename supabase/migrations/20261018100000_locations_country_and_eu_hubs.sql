-- Expand job locations beyond Portugal: companies hiring for Portugal-based
-- roles may also have offices in other major European tech hubs, and want
-- to represent that on a posting. `country` lets the UI group/label the two
-- sets sensibly (e.g. "Portugal" vs "Other Europe") — it's purely a display/
-- grouping fact, not a new taxonomy or a repositioning of the product
-- itself (brand/tagline are untouched, see CLAUDE.md).
--
-- The blanket `grant select on locations to anon, authenticated` from this
-- table's original migration already covers every column, present and
-- future (it was never scoped to a column list) — no new grant needed here.
alter table locations add column country text not null default 'Portugal';
-- The default above only exists to backfill the 14 pre-existing Portuguese
-- rows cleanly; every row from here on should state its own country
-- explicitly, so the column-level default is dropped once that backfill
-- has happened (the insert below sets a real value for every new row).
alter table locations alter column country drop default;

insert into locations (slug, name, latitude, longitude, country) values
  ('london', 'London', 51.5074, -0.1278, 'United Kingdom'),
  ('berlin', 'Berlin', 52.5200, 13.4050, 'Germany'),
  ('munich', 'Munich', 48.1351, 11.5820, 'Germany'),
  ('amsterdam', 'Amsterdam', 52.3676, 4.9041, 'Netherlands'),
  ('dublin', 'Dublin', 53.3498, -6.2603, 'Ireland'),
  ('paris', 'Paris', 48.8566, 2.3522, 'France'),
  ('madrid', 'Madrid', 40.4168, -3.7038, 'Spain'),
  ('barcelona', 'Barcelona', 41.3851, 2.1734, 'Spain'),
  ('warsaw', 'Warsaw', 52.2297, 21.0122, 'Poland'),
  ('krakow', 'Kraków', 50.0647, 19.9450, 'Poland'),
  ('prague', 'Prague', 50.0755, 14.4378, 'Czech Republic'),
  ('vienna', 'Vienna', 48.2082, 16.3738, 'Austria'),
  ('zurich', 'Zürich', 47.3769, 8.5417, 'Switzerland'),
  ('stockholm', 'Stockholm', 59.3293, 18.0686, 'Sweden'),
  ('brussels', 'Brussels', 50.8503, 4.3517, 'Belgium')
on conflict (slug) do nothing;
