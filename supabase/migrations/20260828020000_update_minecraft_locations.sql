-- supabase/migrations/20260828020000_update_minecraft_locations.sql
-- Ubicaciones publicas oficiales del servidor (Semilla -8373583256477433760)

delete from public.minecraft_locations where true;

insert into public.minecraft_locations (name, emoji, x, y, z, dimension, sort_order, description)
values
  ('Spawn Principal', '🏛️', 0, 64, 0, 'overworld', 1, 'Punto de inicio oficial, zona segura protegida del servidor y comando /spawn'),
  ('Fortaleza del End (Stronghold)', '🐉', 1488, 38, -736, 'overworld', 2, 'Fortaleza subterranea con el Portal al End oficial y salas de librerias'),
  ('Fortaleza del Nether', '🌋', -160, 72, 240, 'nether', 3, 'Castillo del Nether con generadores de Blazes, esqueletos de Wither y verrugas'),
  ('Bastión del Nether (Bastion)', '🐗', 96, 60, -368, 'nether', 4, 'Gran fortaleza de Piglins con cofres de botin y plantillas de herreria');