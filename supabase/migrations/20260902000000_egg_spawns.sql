-- Tabla para registrar apariciones de huevos en vivo (Egg Spawns)
create table if not exists public.egg_spawns (
  id uuid primary key default gen_random_uuid(),
  egg_name text not null,
  rarity text not null default 'secreto',
  zone text not null default 'Desconocida',
  server_info text,
  image_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Habilitar RLS
alter table public.egg_spawns enable row level security;

-- Políticas RLS: Lectura pública, Inserción/Modificación solo con service role
create policy "egg_spawns_select_public"
  on public.egg_spawns for select
  using (true);

create policy "egg_spawns_insert_service"
  on public.egg_spawns for insert
  with check (true);

create policy "egg_spawns_delete_service"
  on public.egg_spawns for delete
  using (true);

-- Agregar a publicación en tiempo real de Supabase
alter publication supabase_realtime add table public.egg_spawns;
