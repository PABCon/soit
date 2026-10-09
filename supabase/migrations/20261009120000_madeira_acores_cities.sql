-- Real-usage QA: Madeira and Açores had exactly one city each (Funchal,
-- Ponta Delgada) against 12 for the mainland — real businesses in both
-- archipelagos' other main towns had nowhere accurate to post a job to.
-- Coordinates are each town's real center, same precision as the original
-- seed in 20260923120000_locations_and_categories.sql.

insert into locations (slug, name, latitude, longitude) values
  -- Madeira
  ('camara-de-lobos', 'Câmara de Lobos', 32.6515, -16.9754),
  ('machico', 'Machico', 32.7167, -16.7667),
  ('santa-cruz-madeira', 'Santa Cruz (Madeira)', 32.6880, -16.7892),
  -- Açores
  ('angra-do-heroismo', 'Angra do Heroísmo', 38.6556, -27.2200),
  ('horta', 'Horta', 38.5333, -28.6333),
  ('ribeira-grande', 'Ribeira Grande', 37.8167, -25.5333)
on conflict (slug) do nothing;
