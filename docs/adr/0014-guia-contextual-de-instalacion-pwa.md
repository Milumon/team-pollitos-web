# Guía contextual de instalación de la PWA

## Estado

Aceptada

## Contexto

La instalación de una PWA no se inicia igual en todos los dispositivos y navegadores. Safari en iPhone/iPad requiere usar Compartir, Ver más y Agregar a inicio, mientras que navegadores Chromium pueden ofrecer un diálogo nativo o una opción propia de su menú. Los navegadores integrados de TikTok, Instagram, Facebook y Discord pueden no permitir la instalación directamente.

## Decisión

La aplicación mostrará una Guía de Instalación PWA contextual. Identificará el sistema operativo, el navegador y los navegadores integrados mediante las señales disponibles en el cliente. La guía tendrá instrucciones específicas para Safari iOS, Chrome Android, Samsung Internet, Chrome/Brave/Edge de escritorio, Safari macOS y Firefox. Los navegadores integrados recibirán instrucciones para abrir la URL en Safari o Chrome y una acción para copiar el enlace.

Cuando el navegador soporte `beforeinstallprompt`, se conservará el botón de instalación nativo. Cuando no lo soporte, la guía mostrará los pasos manuales. El aviso puede abrirse automáticamente una vez al día o desde el botón de la landing; si la PWA ya está instalada, no se muestra.

## Consecuencias

- La experiencia de instalación es más precisa para cada navegador.
- La detección depende de señales del agente de usuario y puede requerir ajustes si los navegadores cambian sus identificadores.
- Copiar el enlace funciona como salida segura desde navegadores integrados.
