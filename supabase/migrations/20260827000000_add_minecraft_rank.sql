-- Add minecraft_rank column to profiles table for rank management.
alter table public.profiles
  add column if not exists minecraft_rank text default 'pollito_invitado';

-- Set default rank for existing approved members
update public.profiles
set minecraft_rank = 'pollito_invitado'
where link_status = 'approved' and minecraft_rank is null;
