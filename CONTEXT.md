# Team Pollito Comunidad

Portal unificado para la gestión de la comunidad de Team Pollito, la administración de entrevistas y la interacción en vivo con el stream mediante alertas, sonidos y lectura de voz (TTS).

## Language

**Miembro Oficial (Official Member)**:
Usuario que vinculó sus cuentas de Roblox y TikTok, aceptó las reglas y fue aprobado manualmente en el sistema por el Administrador.
_Avoid_: Miembro verificado, Votante, Usuario común

**Usuario de Roblox (Roblox User)**:
Cuenta de Roblox comprobada y asociada a un Miembro Oficial. Representa la identidad del jugador en Roblox y no es el nombre que el usuario elige para mostrarse dentro del Team Pollito.
_Avoid_: Nickname, Nombre visible, Tag

**Nombre Visible del Miembro (Member Display Name)**:
Nombre elegido por un Miembro Oficial para representar su identidad pública y oficial dentro de Team Pollito. Se muestra en el tag oficial de Roblox y, cuando su Cuenta de Minecraft está verificada y aprobada, en el chat y la lista de jugadores del servidor. El avatar asociado puede ser el avatar de Roblox. Es distinto de los usernames reales de ambas plataformas y puede estar sujeto a las reglas y límites de la comunidad. Si el Miembro no elige un nombre personalizado, se forma usando su Usuario de Roblox entre los emojis `🐣`, por ejemplo `🐣 UsuarioDeRoblox 🐣`.
Cuando se modifica, el nuevo valor se sincroniza con Roblox y con las cuentas de Minecraft ya aprobadas del Miembro.
_Avoid_: Usuario de Roblox, Username de Minecraft, Nickname sin contexto

**Confirmación Inicial de Identidad (Initial Identity Confirmation)**:
Paso que aparece cuando un candidato ya fue aprobado y vuelve a la landing. Permite revisar sus cuentas vinculadas, elegir o confirmar su Nombre Visible del Miembro y aceptar cómo se mostrará en Roblox y Minecraft. El valor por defecto aparece preseleccionado y solo se aplica después de una confirmación explícita; cerrar el paso lo deja pendiente.
La confirmación puede quedar parcialmente completada: el Usuario de TikTok Declarado y el Usuario de Minecraft Declarado se conservan aunque el tag de Roblox falle, pero la identidad no se considera completa hasta resolver Roblox.
Minecraft es opcional: la Confirmación Inicial de Identidad se completa cuando Roblox y TikTok están confirmados, aunque la Cuenta de Minecraft todavía no esté vinculada.
_Avoid_: Configuración del panel, Primer acceso a la consola, Verificación repetida

**Cuenta de Minecraft (Minecraft Account)**:
Cuenta de Minecraft que una persona solicita vincular al portal. Su vinculación es opcional para el Miembro Oficial y requiere el flujo propio de verificación y aprobación de Minecraft. No debe confundirse con un Usuario de Minecraft declarado, que aún no está verificado.
_Avoid_: Nickname de Minecraft, Usuario de Minecraft sin verificar como cuenta vinculada

**Usuario de Minecraft Declarado (Declared Minecraft Username)**:
Nombre de Minecraft que un Miembro Oficial puede guardar como referencia antes de iniciar o completar la vinculación. Puede precargar el formulario de vinculación, pero no concede acceso al servidor ni se muestra como cuenta asociada hasta que Minecraft lo verifique y un Administrador lo apruebe.
_Avoid_: Cuenta de Minecraft, Username verificado, Acceso al servidor

**Candidato (Candidate / Pollito)**:
Usuario que se postuló al Team Pollito y está esperando o agendando su entrevista 1:1.
_Avoid_: Postulante, Aspirante, Candidato a desbaneo

**Entrevista (Interview)**:
Conversación 1:1 sincrónica entre el Streamer (Milumon) y un Candidato para evaluar su ingreso a la comunidad. Se realiza exclusivamente los viernes y puede tener estados como Pendiente o Reprogramada.
_Avoid_: Charla, Reunión, Examen

**Horario (Slot)**:
Bloque de fecha y hora disponible para reservar una Entrevista. Solo se pueden definir en días viernes.
_Avoid_: Turno, Cita, Espacio

**Overlay**:
Página web oculta cargada como fuente de navegador en OBS o TikTok Live Studio que reproduce sonidos y animaciones en vivo.
_Avoid_: Interfaz de transmisión, Alerta de OBS, Widget

**Evento de Stream (Stream Event)**:
Acción interactiva (sonidos, animaciones, TTS) disparada por un Miembro Oficial desde la web que se reproduce en el Overlay.
_Avoid_: Alerta, Notificación, Trigger

**Text-To-Speech (TTS)**:
Servicio de conversión de texto a voz generado mediante la API de Google Cloud TTS e integrado en el Overlay.
_Avoid_: Lector de voz, Voz sintética, Audio de texto

**Panel de Control (Dashboard / Admin Panel)**:
Panel exclusivo para administradores autorizados para gestionar Horarios, Candidatos, Miembros y configurar los límites de transmisión.
_Avoid_: Admin dashboard, Consola de control

**Panel del Miembro (Member Portal)**:
Área privada donde un Miembro Oficial consulta su actividad y rankings, administra su perfil y utiliza las herramientas de interacción con el stream. Su entrada principal es un resumen, no una herramienta concreta.
_Avoid_: Consola, Dashboard administrativo, Panel de Control

**Administrador (Admin / Owner)**:
Usuario con permisos elevados para gestionar la plataforma. El creador principal (Owner) con email kpopxfull@gmail.com posee acceso absoluto inmutable. Los administradores pueden delegar o revocar el rol de administrador a otros Miembros Oficiales desde el Panel de Control.
_Avoid_: Moderador, Staff, Encargado

**Lienzo 9:16 (9:16 Canvas / Vertical Overlay)**:
Proporción vertical del Overlay de OBS Studio diseñada específicamente para transmisiones en TikTok Live y Shorts. Restringe los eventos de animación y alertas al formato vertical del stream.
_Avoid_: Overlay de OBS, Pantalla completa, Widget horizontal

**Testimonio (Testimonial)**:
Opinión opcional enviada por un usuario al finalizar su vinculación de cuentas (onboarding web), sujeta a moderación del administrador para mostrarse en la landing page.
_Avoid_: Reseña, Comentario libre, Crítica

**Registro de Auditoría (Admin Audit Log)**:
Historial guardado en la base de datos que registra toda acción destructiva o de modificación de los administradores en el panel para auditoría y visualización de la actividad en vivo.
_Avoid_: Log del sistema, Historial de visitas, Entrada de consola

**ADN de Diseño / Sistema de Diseño (Design DNA / Design System)**:
Conjunto unificado de directrices visuales basadas en el estilo Neobrutalismo Oscuro Unificado (tipografía Anton/Inter, color amarillo #FFD500, bordes de 3px y sombras duras amarillas en modo oscuro y negras en modo claro). **Excepción**: El Panel de Control (admin) usa un estilo propio más sobrio — `border border-neutral-700/60`, sombras suaves `shadow-[0_4px_12px_rgba(0,0,0,.25)]`, color acento `#FFC200` (no `#FFD500`), y fondos `#2b2d31` / `#35373d` / `#171A20`. Los bordes de 3px y sombras duras son EXCLUSIVOS del sitio público y del panel del miembro.
_Avoid_: Estilo SaaS, UI gamer, Tema Discord

**Guía de Instalación PWA (PWA Installation Guide)**:
Instrucciones contextuales para instalar Team Pollito según el navegador y el dispositivo de origen. Debe usar el nombre y los controles propios del navegador detectado, distinguir Safari de Chrome en iOS, y ofrecer una alternativa para navegadores integrados dentro de otras aplicaciones.
_Avoid_: Instrucciones genéricas de aplicación, Tutorial de móvil

**Envío de Audio (Audio Submission)**:
Audio subido por un Miembro Oficial desde la consola, sujeto a revisión de un Administrador antes de ser disponibilizado como Sonido Público o Sonido Privado. Mientras está en revisión, solo el Miembro que lo envió puede verlo en su historial de envíos.
_Avoid_: Propuesta de sonido, Audio pendiente, Upload de usuario

**Sonido Privado (Private Sound)**:
Sonido aprobado por un Administrador cuyo botón de disparo solo aparece en la consola del Miembro Oficial que lo envió. El Overlay lo reproduce sin distinción respecto a los sonidos públicos.
_Avoid_: Sonido exclusivo, Audio personal, Sonido de usuario

**Sonido Público (Public Sound)**:
Sonido aprobado por un Administrador que aparece en la botonera compartida y puede ser disparado por todos los Miembros Oficiales. Equivalente al comportamiento original de `soundboard_sounds`.
_Avoid_: Sonido global, Audio comunitario, Sonido del admin

**Protección Anti-Spam (Anti-Spam Guard)**:
Mecanismo de seguridad opcional en la Consola del Miembro que solicita confirmación en pantalla antes de disparar sonidos o efectos para evitar clics accidentales. Puede ser deshabilitado por el usuario en el propio diálogo de confirmación o en el panel de Ajustes.
_Avoid_: Diálogo molesto, Confirmación de envío, Alert de spam

**Identidad TikTok (TikTok Identity)**:
Persona reconocida de forma estable por TikTok, aunque cambie su nombre público. Puede estar vinculada a un Miembro Oficial o permanecer sin vincular.
_Avoid_: Username de TikTok, Perfil del portal, Nickname

**Usuario de TikTok Declarado (Declared TikTok Username)**:
Usuario de TikTok que el Miembro Oficial muestra en su perfil del portal. Puede editarse y el cambio se aplica inmediatamente. La edición no modifica los Snapshots de Ranking ni elimina la Identidad TikTok histórica.
_Avoid_: Identidad TikTok, Usuario histórico, Nombre visible del Miembro

**Batch de Rankings (Ranking Batch)**:
Conjunto indivisible de las clasificaciones de espectadores y regalos para último live, 7, 28 y 60 días, capturadas durante una misma importación. Solo puede aceptarse completo.
_Avoid_: Importación parcial, Archivo de rankings, Lista semanal

**Snapshot de Ranking (Ranking Snapshot)**:
Registro histórico e inmutable de una clasificación para una métrica, período y ventana temporal concretos dentro de un Batch de Rankings.
_Avoid_: Ranking actual, Tabla editable, Acumulado

**Activación de Ranking (Ranking Activation)**:
Decisión de hacer visible un Batch de Rankings completo. Una activación posterior puede volver a señalar un batch anterior sin modificar sus snapshots.
_Avoid_: Sobrescritura, Restauración de datos, Publicación parcial

