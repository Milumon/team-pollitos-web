-- Initial identity confirmation for approved community members.
alter table public.profiles
  add column if not exists identity_confirmed_at timestamp with time zone;

alter table public.profiles
  add column if not exists declared_minecraft_username text;
