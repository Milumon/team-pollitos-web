<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## 🚨 Directrices Críticas de Arquitectura & Base de Datos (Matt Pocock Checklist)

### 1. Migraciones de Supabase (MANDATORIO)
- **Toda nueva migración DEBE crearse obligatoriamente dentro de `supabase/migrations/`**.
- Formato de nombre estricto con timestamp UTC: `supabase/migrations/YYYYMMDDHHMMSS_descripcion.sql` (ej: `20260828000000_stream_comments_and_overlay.sql`).
- **NUNCA colocar migraciones sueltas en la raíz `supabase/*.sql`**, ya que el pipeline de GitHub Actions (`.github/workflows/deploy.yml`) ejecuta `supabase db push --db-url "$DATABASE_URL"`, el cual **solo lee y aplica los archivos dentro de `supabase/migrations/`**.
- Todo schema nuevo debe incluir políticas RLS explícitas (`alter table public.xxx enable row level security;`) y habilitar Realtime en la publicación `supabase_realtime` si es consumido por overlays o paneles interactivos.

### 2. Contratos de Comunicación con la VM (`roblox-alexa`)
- La API de Next.js se comunica con la VM de GCP (`roblox-alexa-vm`) mediante proxy seguro usando el header `x-shared-secret: process.env.ROBLOX_ALEXA_SHARED_SECRET`.
- Endpoints de control de TikTok Live Listener:
  - `GET /api/admin/tiktok-listener?action=status|logs`
  - `POST /api/admin/tiktok-listener` con `{ "action": "start" | "stop" }`

### 3. Sistema de Overlays en Tiempo Real
- `/overlay/chat`: Overlay para OBS Browser Source (1920x1080 transparente). Consume `stream_comments` vía Supabase Realtime (INSERT) y `stream_chat_settings` (UPDATE).
- `/admin/chat-overlay`: Panel administrativo para controlar filtros (seguidores, subs, mods, badges) y posición en pantalla.

### 4. Integración Minecraft & Anuncios Globales
- `/api/minecraft/status`: Endpoint público de telemetría (TPS, MSPT, jugadores online).
- `/api/minecraft/broadcasts`: Encolamiento de anuncios web -> servidor Minecraft.
- `/api/minecraft/broadcasts/pending`: Endpoint protegido con `x-minecraft-bridge-token` para que el plugin Paper/Spigot del servidor recoja y limpie mensajes pendientes.
- `/api/minecraft/locations`: Puntos de interés del servidor (Spawn, Pueblo Pollito, Arena) con soporte de coordenadas.

### 5. Landing Page Features
- `<LiveBanner />`: Banner superior que reacciona a `stream_status.is_live` en tiempo real.
- `<TopFansPodium />`: Podio visual de los top 3 fans obtenido de los snapshots de rankings de TikTok.

## Agent skills

### Issue tracker
Issues live as GitHub issues. External PRs are not treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels
Using default triage label vocabulary: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs
Single-context layout: one CONTEXT.md + docs/adr/ at the root. See `docs/agents/domain.md`.

## Language
- En las conversaciones en español, utiliza siempre español neutro (evitando el voseo rioplatense, el acento argentino o cualquier otro modismo regional).