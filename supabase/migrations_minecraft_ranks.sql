-- Migration: Add minecraft_rank to profiles table
alter table public.profiles
  add column if not exists minecraft_rank text not null default 'pollito_invitado'
  check (minecraft_rank in ('pollito_invitado', 'pollito_oficial', 'pollito_admin'));

create index if not exists profiles_minecraft_rank_idx
  on public.profiles(minecraft_rank);
