-- Company address + map pin (real-usage QA: employer-console review, item
-- 5). Reuses the existing curated `locations` table for the map pin —
-- same "no geocoding dependency" reasoning that already moved `jobs.
-- location` off free text (§ locations_and_categories migration): the pin
-- sits at the chosen city's centroid. `address` is a free-text street
-- address shown as a human-readable line next to the map, not itself
-- geocoded.

alter table companies
  add column location_id uuid references locations(id),
  add column address text;

create index companies_location_id_idx on companies (location_id);

-- GRANT is column-additive, not a replace — same gotcha as every prior
-- companies-column migration in this project (companies_profile_fields.sql).
grant select (location_id, address) on companies to anon, authenticated;
grant update (location_id, address) on companies to authenticated;
