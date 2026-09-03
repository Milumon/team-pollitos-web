# Overlay de Spawns: Diseño Cartoon Gaming y Manejo de Imágenes Nulas

## Estado

Aceptada

## Contexto

El overlay `/overlay/egg-spawns` muestra en OBS y transmisiones en vivo los eventos de aparición de huevos raros (Secretos, Eternos, Divinos) emitidos por el detector de Steal An Egg.
La versión anterior presentaba problemas de visualización en directo:
1. Cuando un huevo no incluía imagen (`image_url` nulo), se renderizaba un emoji de huevo genérico en un contenedor fijo de 220x220px, ocupando espacio vacío innecesario en el stream.
2. Los emojis e iconografía no coincidían con los utilizados en las alertas de Discord y TikTok.
3. El diseño cuadrado plano carecía de contraste para destacar con claridad sobre el gameplay de Roblox en vivo.

## Decisión

1. **Estética Cartoon / Gaming con Contraste 3D**:
   - Pestaña superior tipo folder (`ÚLTIMA APARICIÓN`) con borde de 3px y sombra sólida.
   - Tipografía gruesa (`Arial Black`) con `textShadow` de alto contraste en 4 direcciones para garantizar legibilidad instantánea sobre cualquier fondo de juego.
   - Bordes negros sólidos de 3px con sombras duras inferiores (`box-shadow: 0 4px/5px 0 ...`) estilo videojuego.
   - Temas dinámicos de color y resplandor según la rareza (Secreto: púrpura/violeta, Eterno: azul cósmico, Divino: dorado ámbar).

2. **Supresión Absoluta de Contenedores cuando no hay Foto**:
   - Si `image_url` es nulo o falla la carga, el contenedor de avatar desaparece completamente del DOM. No se renderiza ningún huevo de relleno ni espacio vacío.
   - El nombre del huevo se expande a todo el ancho y la tarjeta colapsa su altura a un formato compacto rectangular (~75px).

3. **Consistencia de Emojis con Discord**:
   - Rarezas: `🔮` Secreto, `🌌` Eterno, `✨` Divino.
   - Biomas dinámicos: `🌋` Volcano, `🌸` Cherry Blossom, `🦖` Prehistoric, `🌌` Cosmic, `🌊` Ocean, `🏛️` Titan, `❄️` Snow, `🌴` Jungle.
   - Tiempo transcurrido en pastilla verde: `🕐 {timeText}`.

4. **Carrusel Multihuevo**:
   - Cuando una tanda incluye múltiples huevos (dentro de la ventana de 2 minutos), se muestran indicadores de píldora que rotan suavemente cada 5 segundos.

## Consecuencias

- El overlay ocupa el espacio mínimo indispensable en pantalla cuando no hay imagen disponible.
- La estética encaja orgánicamente con el universo de Roblox y TikTok Live.
- Los espectadores reconocen inmediatamente la rareza y el bioma gracias a la iconografía idéntica a Discord.
