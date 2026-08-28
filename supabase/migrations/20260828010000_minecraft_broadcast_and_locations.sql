-- supabase/migrations_minecraft_broadcast.sql
-- Cola de mensajes broadcast web -> Minecraft + Lugares de interes

-- 1. Cola de broadcasts
create table if not exists public.minecraft_broadcasts (
  id uuid primary key default gen_random_uuid(),
  message text not null check (length(message) between 1 and 256),
  sent_by text not null,
  delivered boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists minecraft_broadcasts_pending_idx
  on public.minecraft_broadcasts (delivered, created_at)
  where delivered = false;

alter table public.minecraft_broadcasts enable row level security;

-- Solo service_role puede leer/escribir (admin API + bridge plugin)
drop policy if exists "service_all_minecraft_broadcasts" on public.minecraft_broadcasts;
create policy "service_all_minecraft_broadcasts" on public.minecraft_broadcasts
  for all using (true) with check (true);

-- 2. Lugares de interes del servidor
create table if not exists public.minecraft_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '📍',
  x int not null,
  y int,
  z int not null,
  dimension text not null default 'overworld'
    check (dimension in ('overworld', 'nether', 'the_end')),
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.minecraft_locations enable row level security;
drop policy if exists "public_read_minecraft_locations" on public.minecraft_locations;
create policy "public_read_minecraft_locations" on public.minecraft_locations
  for select using (true);

-- Seed con ubicaciones iniciales
insert into public.minecraft_locations (name, emoji, x, y, z, sort_order, description)
values
  ('Spawn Principal', '🏛️', 0, 64, 0, 1, 'Punto de aparicion del servidor'),
  ('Pueblo Pollito', '🏘️', 150, 70, -200, 2, 'Zona comunitaria del Team Pollito'),
  ('Arena de Eventos', '🎪', -300, 65, 100, 3, 'Minijuegos y eventos especiales')
on conflict do nothing;
