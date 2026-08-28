# Unificación del Portal de Comunidad en un único repositorio

Decidimos migrar y unificar los proyectos `team-pollito-entrevistas` y `team-pollitos-web` en un solo repositorio Next.js y bajo una única base de datos Supabase. Esta consolidación permite centralizar la autenticación de usuarios de Google, verificar las cuentas de Roblox en un solo lugar y sincronizar eventos de sonido/TTS en tiempo real para el vivo de TikTok de forma directa y económica.

## Considered Options

- **Proyectos y Bases de Datos Separadas**: Mantener repos y bases de datos independientes. Se rechazó por la alta complejidad para compartir sesiones de usuario, lidiar con CORS entre dominios y duplicar costos/mantenimiento de Supabase.
- **Unificación en un único repositorio (Elegido)**: Consolidar el código de entrevistas en el proyecto de los Awards (que ya tiene configurado Google OAuth y perfil de Roblox) y migrar los esquemas a una sola instancia de Supabase.

## Consequences

- **Seguridad y Validación**: Para interactuar en la web o usar comandos en el chat de TikTok, el usuario solicitará la vinculación de su Roblox User y TikTok User desde la web. El Administrador aprobará esta solicitud manualmente desde el Panel de Control, simplificando la experiencia del usuario final.
- **Interacción Multicanal**: Los miembros aprobados podrán disparar sonidos y TTS desde la interfaz web (PWA) o escribiendo comandos directamente en el chat del directo de TikTok (ej. `!risa`), los cuales serán validados por el script de bridge contra Supabase y reproducidos en el Overlay.
- **Interacción en tiempo real**: Se usará Supabase Realtime para que la vista del Overlay en OBS escuche los eventos insertados por los miembros y los reproduzca al instante.
- **Voz sintética**: El TTS se generará llamando a la API de Google Cloud Text-To-Speech en un API Route dedicado de Next.js, priorizando la calidad de las voces neurales.
- **Límites**: El panel de administración contará con controles para pausar/mutear el overlay y configurar los límites de cooldown en caliente.
