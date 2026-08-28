-- supabase/migrations_stream_comments.sql
-- Comentarios filtrados del live TikTok (insertados por el listener en la VM)
-- + Configuracion del overlay de chat + Estado del stream + Sesiones de Live

-- 1. Tabla de sesiones de live
create table if not exists public.stream_sessions (
  id text primary key, -- ej: '2026-08-28_10-45_milumon_gaming'
  tiktok_username text not null,
  room_id text,
  title text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_comments int not null default 0,
  peak_viewers int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.stream_sessions enable row level security;
drop policy if exists "public_read_stream_sessions" on public.stream_sessions;
create policy "public_read_stream_sessions" on public.stream_sessions
  for select using (true);
drop policy if exists "service_all_stream_sessions" on public.stream_sessions;
create policy "service_all_stream_sessions" on public.stream_sessions
  for all using (true) with check (true);

-- 2. Tabla de comentarios filtrados
create table if not exists public.stream_comments (
  id uuid primary key default gen_random_uuid(),
  session_id text references public.stream_sessions(id) on delete set null,
  offset_sec numeric(8,2) default 0,
  tiktok_user text not null,
  nickname text not null,
  message text not null,
  avatar_url text,
  badges jsonb default '[]'::jsonb,
  team_member_level int default 0,
  is_follower boolean default false,
  is_subscriber boolean default false,
  is_moderator boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists stream_comments_session_idx
  on public.stream_comments (session_id, offset_sec);
create index if not exists stream_comments_created_idx
  on public.stream_comments (created_at desc);

-- Auto-cleanup: mantener solo los ultimos 2000 comentarios activos en DB
create or replace function public.trim_stream_comments()
returns trigger language plpgsql security definer as $$
begin
  delete from public.stream_comments
  where id in (
    select id from public.stream_comments
    order by created_at desc
    offset 2000
  );
  return null;
end; $$;

drop trigger if exists trim_old_comments on public.stream_comments;
create trigger trim_old_comments
  after insert on public.stream_comments
  for each statement execute function public.trim_stream_comments();

alter table public.stream_comments enable row level security;
drop policy if exists "public_read_stream_comments" on public.stream_comments;
create policy "public_read_stream_comments" on public.stream_comments
  for select using (true);
drop policy if exists "service_insert_stream_comments" on public.stream_comments;
create policy "service_insert_stream_comments" on public.stream_comments
  for insert with check (true);

alter publication supabase_realtime add table public.stream_comments;

-- 3. Configuracion del overlay de chat
create table if not exists public.stream_chat_settings (
  id int primary key default 1 check (id = 1),
  followers_only boolean not null default false,
  subscribers_only boolean not null default false,
  moderators_only boolean not null default false,
  min_team_member_level int not null default 0,
  emoji_filter text default null,
  chat_position_x int not null default 20,
  chat_position_y int not null default 400,
  chat_width int not null default 350,
  chat_max_messages int not null default 12,
  chat_font_size int not null default 15,
  chat_opacity numeric(3,2) not null default 0.85,
  chat_direction text not null default 'bottom-up'
    check (chat_direction in ('bottom-up', 'top-down')),
  chat_theme text not null default 'glassmorphism'
    check (chat_theme in ('glassmorphism', 'solid', 'minimal', 'neon')),
  show_avatars boolean not null default false,
  show_badges boolean not null default true,
  is_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.stream_chat_settings enable row level security;
drop policy if exists "public_read_stream_chat_settings" on public.stream_chat_settings;
create policy "public_read_stream_chat_settings" on public.stream_chat_settings
  for select using (true);

insert into public.stream_chat_settings (id) values (1) on conflict (id) do nothing;
alter publication supabase_realtime add table public.stream_chat_settings;

-- 4. Estado del stream (is_live flag)
create table if not exists public.stream_status (
  id int primary key default 1 check (id = 1),
  is_live boolean not null default false,
  active_session_id text references public.stream_sessions(id) on delete set null,
  tiktok_username text not null default 'milumon_gaming',
  viewer_count int not null default 0,
  stream_title text,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.stream_status enable row level security;
drop policy if exists "public_read_stream_status" on public.stream_status;
create policy "public_read_stream_status" on public.stream_status
  for select using (true);

insert into public.stream_status (id) values (1) on conflict (id) do nothing;
alter publication supabase_realtime add table public.stream_status;
