-- Migration: Egg Predictions Status & Overlay
-- Date: 2026-09-01

create table if not exists public.egg_predictions (
    id text primary key default 'current',
    next_egg jsonb not null default '{}'::jsonb,
    upcoming_eggs jsonb not null default '[]'::jsonb,
    raw_text text,
    updated_at timestamptz not null default now()
);

alter table public.egg_predictions enable row level security;

create policy "Allow public read access on egg_predictions"
on public.egg_predictions for select
using (true);

create policy "Allow service_role full access on egg_predictions"
on public.egg_predictions for all
using (true)
with check (true);

-- Enable Supabase Realtime on egg_predictions
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.egg_predictions;
  end if;
end $$;
