# Integración Directa de la API de Roblox para Etiquetado de Amigos

Decidimos implementar el flujo de etiquetado/des-etiquetado individual de cuentas en Roblox directamente dentro del backend de `team-pollitos-web` (monorepo unificado) a través de [lib/robloxAdmin.ts](file:///d:/GitHub/team-pollitos-web/lib/robloxAdmin.ts), en lugar de consumir microservicios externos o el proxy `roblox-alexa`.

## Contexto

El sistema requiere añadir el prefijo `🐣` al display name de Roblox cuando un candidato es aprobado como Miembro Oficial por la administración (Milumon), y removerlo si su membresía es revocada. 

Inicialmente se consideró delegar esto a un servicio externo llamado `roblox-alexa` (que actúa como proxy o bot de Roblox). Sin embargo, para simplificar el despliegue del ecosistema, unificar dependencias y evitar llamadas de red redundantes inter-servicios, centralizamos este comportamiento.

## Solución Elegida

- **Uso directo de Contacts API de Roblox**: Se consume el endpoint `https://contacts.roblox.com/v1/user/tag` pasándole el `targetUserId` y el `userTag` (`🐣 {displayName} 🐣` al aprobar, o vacío al revocar).
- **Mapeo de Sesión Administrativa**: Se reutiliza la cookie `.ROBLOSECURITY` configurada en las variables de entorno de la aplicación para interactuar con las APIs oficiales de Roblox.
- **Mecanismo de CSRF Token**: Se implementó una función auxiliar `getCsrfToken()` que realiza una petición de logout simulada para obtener el token `x-csrf-token` requerido por Roblox en peticiones mutables (`POST`), con reintento automático ante expiración (HTTP 403).

## Consecuencias

- **Mayor Cohesión**: Toda la lógica administrativa de vinculación y estado de la comunidad reside en el mismo proyecto Next.js.
- **Reducción de Latencia**: Se reduce un salto de red (Next.js -> roblox-alexa -> Roblox API) a una interacción directa (Next.js -> Roblox API).
- **Control de Errores Simplificado**: Si la API de Roblox falla o la cookie de sesión del bot expira, el endpoint de verificación `/api/admin/verify` puede atrapar y reportar el error de forma directa e inmediata a la UI de administración.
