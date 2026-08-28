# PRD: Portal de Comunidad de Team Pollito y Sistema de Interacción en Vivo

## Problem Statement

Milumon (el streamer) y el Team Pollito (la comunidad oficial) necesitan un espacio digital centralizado. Anteriormente, la gestión de entrevistas, la votación de los premios (Awards) y las automatizaciones en Roblox se encontraban en repositorios y bases de datos de Supabase desconectados. Además, Milumon desea dar valor y dinamismo a sus streams en vivo de TikTok mediante la participación interactiva de los miembros oficiales verificados (TTS y soundboard), lo cual requiere un control estricto de spam para evitar que el stream sea caótico o inmanejable.

## Solution

Desarrollar un Portal de Comunidad consolidado en un único repositorio Next.js y bajo la base de datos Supabase unificada. El portal permitirá a los visitantes leer las reglas del Team Pollito, ver miembros activos con sus avatares reales de Roblox y agendar entrevistas exclusivas los viernes mediante un sistema de slots. Los usuarios logueados podrán solicitar la vinculación de sus cuentas de Roblox y TikTok mediante aprobación manual del Administrador. Una vez aprobados como Miembros Oficiales, la web les habilitará la Consola en Vivo con TTS (Google Cloud) y soundboard de audios MP3. Todo esto se reproduce de manera ordenada (cola FIFO) en un Overlay web que Milumon agrega a OBS, controlado en caliente por Milumon con un "Botón de Pánico" y cooldowns globales configurables. Los miembros también podrán disparar estos sonidos escribiendo comandos de chat en TikTok Live que serán validados por el bridge de chat.

## User Stories

1. As a visitor, I want to view the community landing page with rules and official members, so that I can understand what the Team Pollito community is about.
2. As a candidate, I want to book an interview slot exclusively on an available Friday, so that I can have a 1:1 conversation with Milumon to join the team.
3. As a candidate, I want to submit a returning application if I was banned, so that I can explain my situation and request to rejoin.
4. As a candidate, I want to view my interview status, so that I can know if I need to reschedule or wait for my turn.
5. As an authenticated user, I want to submit my Roblox and TikTok usernames in an onboarding modal, so that I can request to link my profiles and become an official member.
6. As an authenticated user, I want to see a clear message if my linking request is rejected, showing the reason provided by the administrator, so that I can correct my details and resubmit.
7. As an official member, I want to access the live console page after approval, so that I can interact with Milumon's stream in real time.
8. As an official member, I want to trigger a sound effect from the soundboard on the web, so that it plays in real time on Milumon's live stream.
9. As an official member, I want to write a text message in the TTS input, so that Google Cloud reads it out loud in Milumon's live stream.
10. As an official member, I want to trigger animations and visual effects (such as falling eggs or gifs), so that they render in real time on the stream screen.
11. As an official member, I want to see the remaining cooldown time on sound/TTS buttons after triggering an action, so that I know when I can participate again.
12. As an official member, I want to view a real-time list of recent events and the current queue, so that I know what is currently playing on the stream and which events are next.
13. As an official member, I want to write commands like `!risa` or `!tts` directly in the TikTok Live chat, so that the event is triggered in the stream without needing to open the web.
14. As an official member, I want to install the web portal as a PWA on my mobile phone's home screen, so that I can launch it in full screen and use the soundboard comfortably with one hand.
15. As the streamer (Milumon), I want to log into the admin dashboard (`/admin`), so that I can manage community applications and streaming configurations securely.
16. As the streamer, I want to click a global "Panic Button" to mute or pause all overlay sounds and TTS instantly, so that I can have silence or peace during my stream.
17. As the streamer, I want to adjust individual and global cooldown limits for sounds and TTS in real time, so that I can scale down interactions if there is too much spam.
18. As the streamer, I want to review pending link requests, with one-click direct links to the applicant's TikTok profile, so that I can verify their identity easily before approving or rejecting.
19. As the streamer, I want to provide a rejection reason when declining a user's link request, so that they know what went wrong and how to fix it.
20. As the streamer, I want the system to automatically trigger the Roblox tag API (`/tag`) to add or remove the `🐣` nickname on Roblox when I approve or revoke an official member.
21. As the streamer, I want to manage available Friday slots for interviews, so that candidates can only book dates when I am available.
22. As the streamer, I want to reschedule a booked interview, so that the slot is freed up and the candidate is notified to pick a different date.

## Implementation Decisions

### Modules & Architecture

- **Single Next.js codebase (team-pollitos-web)**: React 19, TailwindCSS v4, App Router, TypeScript.
- **PWA Configuration**: Use `@ducanh2912/next-pwa` to enable installation on Android/iOS, configure `manifest.json`, and set up caching for soundboard MP3 files and fonts to ensure fast loading times.
- **API routes**:
  - `/api/profile/link`: Processes Google Auth profiles and creates pending link records for `roblox_username` and `tiktok_username`.
  - `/api/admin/verify`: Approves/rejects requests. Fires Roblox tag script on approval.
  - `/api/stream/events`: Accepts post requests for sounds/TTS (validating cooldowns in Supabase) and inserts records to trigger Supabase Realtime.
  - `/api/stream/tts`: Next.js Serverless Route that wraps Google Cloud TTS API, converting text to MP3 audio stream.
  - `/api/roblox/*`: Ported endpoints from `roblox-alexa` (tag, accept, clean) using Server-Side cookie `.ROBLOSECURITY`.
- **OBS Overlay (`/overlay`)**: A client-side React component that listens to Supabase Realtime event inserts. It maintains a FIFO Javascript Queue to play audios (HTML5 Audio Element with `.onended` listener) and render animations sequentially.
- **Supabase Realtime integration**: Enabled on `stream_events` and `stream_settings` tables for instant synchronization between users, admin configs, and OBS overlay.
- **TikTok Chat Bridge (`kick-tiktok-bridge`)**: Keeps running as a local background process. Listens to TikTok Live via `tiktok-live-connector`, checks the `profiles` table in Supabase to verify if the sender is an approved member, and triggers the stream event API endpoint.

### Schema Changes (Supabase)

```sql
-- Profiles table extension
alter table public.profiles
  add column if not exists tiktok_user text,
  add column if not exists link_status text default 'none' check (link_status in ('none', 'pending', 'approved', 'rejected')),
  add column if not exists rejection_reason text;

-- Table to store historical and new interviews
create table if not exists public.interview_history (
  id bigserial primary key,
  roblox_user text not null,
  tiktok_user text not null,
  status text not null check (status in ('pending', 'official', 'rejected')),
  interview_date date,
  interview_time time,
  moderator text,
  created_at timestamp with time zone default now()
);

-- Stream events table (FIFO Queue source)
create table if not exists public.stream_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete set null,
  type text not null check (type in ('sound', 'tts', 'animation')),
  content text not null, -- MP3 filename, TTS text, or animation ID
  sender_roblox_user text,
  sender_tiktok_user text,
  played boolean default false,
  created_at timestamp with time zone default now()
);

-- Stream settings table (Panic button and cooldowns)
create table if not exists public.stream_settings (
  id integer primary key default 1,
  is_muted boolean not null default false,
  global_cooldown_seconds integer not null default 30,
  personal_cooldown_seconds integer not null default 300, -- 5 mins for TTS
  updated_at timestamp with time zone default now()
);
```

## Testing Decisions

### What makes a good test
- Tests should assert external behavior, not implementation details.
- Tests will run headlessly mock-testing API endpoints and database wrappers.
- Do not make actual API calls to Roblox or Google Cloud TTS in tests.

### Modules to be tested
- **API endpoints**: Test `/api/stream/events` for cooldown enforcement (both individual and global).
- **Google Cloud TTS wrapper**: Test `lib/googleTts.ts` error handling and empty states.
- **Onboarding and approval flows**: Verify transitioning `link_status` state machine from `pending` to `approved` / `rejected`.

### Prior Art
- Existing API test setup in `app/api/results/route.ts` and Supabase client mocking helpers in the project.

## Out of Scope

- Native iOS/Android push notifications via system centers (handled in-app instead).
- Verification of TikTok profiles via OAuth (using manual verification via administrative link clicks).
- Complex point-based shop systems (relying on simple configurable timers/cooldowns).

## Further Notes

- Sourced and preserved all historical interview records (229 candidates, 22 returning applications, 43 members) in `historical_interviews_backup.json` to seed the database.
- Google Cloud TTS credentials must be stored securely as a JSON environment variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` in the production environment.
