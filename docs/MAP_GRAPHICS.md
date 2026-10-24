# Gráficos de la ciudad — Monigones v0.3

## Motor y estructura

La ciudad jugable usa **Canvas 2D** con texturas raster originales, orden por profundidad, cámara con Pointer Events, pellizco, rueda y teclado. Sustituye el renderizado SVG del mapa de v0.2. No se ha añadido una dependencia de motor: el coste de 15 edificios y una base urbana no necesita física ni un framework de escenas.

`src/components/CanvasCity.tsx` dibuja un mundo de 1600 × 2400. `src/lib/visuals.ts` define las 15 posiciones y la cámara. `src/lib/v03-atlas-bounds.json` guarda recortes medidos sobre el alfa real, no una división ciega en celdas iguales. `scripts/analyze-v03.mjs` permite volver a medir los cinco atlas arquitectónicos con el servidor de revisión en 5175. Los edificios de los detalles de ampliación utilizan las mismas texturas mediante un viewport SVG; el mapa principal se dibuja enteramente en Canvas.

Los 15 enlaces accesibles se superponen a los edificios y comparten exactamente su transformación y sus recortes. Los edificios decorativos no tienen enlace ni etiqueta. El estado de juego, rutas, edificios, instalaciones, colas y notificaciones siguen perteneciendo al motor anterior.

## Dirección artística y recursos

Ciudad deportiva mediterránea contemporánea: ladrillo cálido, piedra, cristal, cubiertas planas, vegetación variada, luz desde arriba a la izquierda y sombras hacia abajo a la derecha. Estadio protagonista; sede y oficinas agrupadas; cantera y entrenamientos junto a las pistas; zona institucional al sur. La referencia visual mencionada en el encargo no estaba adjunta: se decidió esta dirección sin copiar un videojuego externo.

Se han generado **7 PNG originales con la herramienta integrada de generación de imágenes**, sin API externa ni fotografías descargadas:

| Recurso     | Contenido                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------- |
| `ground`    | Barrio urbano, calzadas, aceras, cruces, aparcamiento, residencias, comercios, pistas y plazas |
| `core`      | Sede, estadio y centro de investigación; cinco arquitecturas cada uno                          |
| `training`  | Marketing, cantera y entrenamiento; cinco variantes                                            |
| `commerce`  | Oficinas, dirección deportiva y tienda; cinco variantes                                        |
| `relations` | Finanzas, afición e institucional; cinco variantes                                             |
| `culture`   | Prensa, museo y competición; cinco variantes                                                   |
| `props`     | Kioscos de aficionados, aparcamiento, autobús, jardín, tornos y pistas                         |

Originales: `assets-source/art/v03/*.png`. Texturas web: `public/art/v03/*.webp`, preservando alfa. Prompts: [V03_ART_PROMPTS.json](V03_ART_PROMPTS.json). No se reutilizan edificios de terceros. Las sombras de los sprites están integradas en su transparencia; el entorno, las personas y el alumbrado aportan profundidad adicional. La ilustración base contiene detalles no interactivos.

Los 13 edificios mejorables utilizan sus cinco variantes. Oficinas y competición tienen un recorte fijo, conforme a sus reglas anteriores. La escala crece de forma moderada con el nivel y cambian volúmenes, fachadas, anexos y cubiertas. También aumentan peatones, vehículos y vegetación; los niveles altos añaden luz de acceso. El estado de obra representa trabajos reales de la cola. La jornada activa añade aficionados y luz al estadio; el concierto conserva su ambiente y el audio existente.

## Cámara y rendimiento

Zoom 0,27–1,15, con mínimo adaptado para cubrir el viewport. Cada modificación, rueda, arrastre, pellizco, teclado, Home y cambio de tamaño pasa por el mismo límite. En cada eje: `[viewport − mundo × zoom, 0]`; si el mundo es menor se centra. No hay margen exterior de 70 px. El arrastre supera un umbral de 7 px antes de bloquear la pulsación; el pellizco anula la selección. Los controles visibles de zoom, porcentaje y navegación se han retirado.

Texturas cargadas y decodificadas una vez, DPR limitado a 2, animación máxima de 30 fps. Calidad media reduce agentes; calidad baja o movimiento reducido detiene la animación continua. El primer dibujo espera la decodificación de sus texturas. Se conserva la columna máxima de 460 px en escritorio.

## Revisión visual

Galería: [capturas v0.3](screenshots/v03/index.html). La comparación usa viewport idéntico 390 × 844 y el encuadre inicial del estadio. El mundo y la proyección cambian; no son coordenadas equivalentes entre motores.

Se revisan nivel 1/5, jornada, concierto, obras, vista general y extremos. Tras la primera revisión se redujeron solapamientos de edificios y se llenó la parte trasera de la explanada del estadio con infraestructura original para aficionados, aparcamiento y autobús. La imagen generada sigue siendo arte estilizado: no equivale a una recreación tridimensional ni a un render físicamente exacto. Quedan pequeñas irregularidades de perspectiva propias de los atlas generados; no se afirma un acabado AAA.
