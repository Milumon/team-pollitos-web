# Overlays de Spawns y Predicciones: Diseño Unificado Cartoon Gaming

## Estado

Aceptada

## Contexto

Los overlays `/overlay/egg-spawns` y `/overlay/egg-predictor` muestran en OBS y transmisiones en vivo los eventos de aparición y las predicciones de huevos raros (Secretos, Eternos, Divinos) emitidos por el bot de Steal An Egg.
La versión anterior presentaba disparidad visual:
1. El predictor usaba un formato minimalista oscuro mientras que el spawn evolucionó a un estilo Cartoon Gaming con alto contraste 3D.
2. Cuando un huevo no incluía imagen (`image_url` nulo), se renderizaban contenedores vacíos o emojis desproporcionados.
3. Se requería una identidad visual unificada para que ambos widgets luzcan como un conjunto cohesivo en el stream.

## Decisión

1. **Estética Unificada Cartoon / Gaming con Contraste 3D**:
   - Pestaña superior tipo folder (`ÚLTIMA APARICIÓN` en spawns, `PRÓXIMO HUEVO` en predictor) con borde de 3px y sombra sólida.
   - Tipografía gruesa (`Arial Black`) con `textShadow` de alto contraste en 4 direcciones para garantizar legibilidad instantánea sobre cualquier fondo de juego de Roblox.
   - Bordes negros sólidos de 3px con sombras duras inferiores (`box-shadow: 0 4px/5px 0 ...`) estilo videojuego.
   - Temas dinámicos de color y resplandor según la rareza (Secreto: púrpura/violeta, Eterno: azul cósmico, Divino: dorado ámbar).

2. **Supresión Absoluta de Contenedores cuando no hay Foto**:
   - Si `image_url` es nulo o no aplica (como en el predictor), el contenedor de avatar desaparece completamente del DOM. No se renderiza ningún huevo de relleno ni espacio vacío.
   - El nombre del huevo se expande a todo el ancho y la tarjeta colapsa su altura a un formato compacto rectangular.

3. **Consistencia de Emojis con Discord**:
   - Rarezas: `🔮` Secreto, `🌌` Eterno, `✨` Divino.
   - Biomas dinámicos: `🌋` Volcano, `🌸` Cherry Blossom, `🦖` Prehistoric, `🌌` Cosmic, `🌊` Ocean, `🏛️` Titan, `❄️` Snow, `🌴` Jungle.
   - Tiempo / Cuenta regresiva en pastilla verde o roja en vivo: `⏱️ {countdown}` / `🕐 {timeText}`.
   - Probabilidad en pastilla naranja: `🎯 {prob}`.

4. **Cola de Predicciones Cartoon**:
   - En el predictor, los siguientes huevos en cola se presentan con mini barras de probabilidad colorizadas según la rareza del huevo proyectado.

## Consecuencias

- Ambos overlays lucen armónicos, profesionales y perfectamente integrados en OBS Studio y TikTok Live Studio.
- No hay desperdicio de pixeles ni espacios vacíos en pantalla.
- La experiencia del espectador es consistente entre spawns confirmados y predicciones futuras.
