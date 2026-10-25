# Auditoría de experiencia v0.6

## Implementación

- Un único formateador español: `formatEuros()` recibe euros y `formatMoney()` céntimos. Miles siempre separados, céntimos solo cuando existen. `shortMoney()` mantiene su API por compatibilidad pero ya no abrevia M€. Bases de datos y reglas siguen usando enteros.
- Campos de dinero de mercado, negociación, contraoferta y subasta con mínimo/máximo/disponible propio, errores junto al campo y texto conservado. El servidor aplica los mismos límites reales; una contraoferta no consulta el saldo del comprador. Las pujas rivales siguen ocultas.
- Ayuda ⓘ centralizada en `shared/help.ts`, 36 conceptos consultables con tacto/teclado. Diálogo con cierre, Escape, foco, scroll y acceso a otros conceptos; reglas, límites y ejemplos vinculados al motor.
- Oficinas: cada uno de los nueve módulos reúne descripción, estado, condiciones, avisos y acción. Los bloqueados explican el día/investigación/fondos necesarios. Sin cuadrícula de enlaces separada al pie.
- Cabecera: Monigones, chat, audio y noticias. Club/escudo personal siguen en Mi club. Chat de cabecera y periódico abren el mismo panel y componente que la ruta Chat, con el mismo backend, mensajes y lectura. Borradores de sesión delimitados por liga/club; panel remonta al cambiar ese contexto.
- Canvas sin personajes ni vehículos en circulación, sin bucle de dibujo perpetuo. Un frame por cambio de cámara/tamaño/estado; texturas, edificios, decoración estática y focos de jornada/concierto conservados. Calidad controla resolución, no población.
- Menú inferior calcula su posición con `visualViewport.height/offsetTop` y la zona segura. La altura no depende de la ruta ni de su documento. El contenido reserva espacio; el mapa usa la misma referencia. Teclado detectado mediante foco y compresión del viewport, con política común para todas las pantallas.
- `touch-action` en la jerarquía real, cancelación de gestos Safari y multitouch fuera de `.city-map`; el mapa conserva su gesto interno. Controles sin doble toque accidental, formularios de al menos 16px y scroll vertical. No se usa `user-scalable=no`: accesibilidad/zoom del sistema, gestos que el navegador reserve y Ctrl/Cmd zoom siguen bajo control del navegador.
- Entrenamiento: dibujo consultable sin comando de cambio de once, once índices persistentes y categorías con etiquetas, borde, icono y bonus. Véase [TACTICAL_SLOTS.md](TACTICAL_SLOTS.md).

## Alcance de comprobación

Las pruebas automáticas usan Chromium móvil, WebKit móvil, perfiles sin extensiones y viewport de 320×568, 375×812, 390×844, 430×932 y 1440×1000. Comparan geometría del menú entre las cinco rutas principales, desbordamiento, interacción, imágenes, ayudas, chat simultáneo y formación. Las capturas y medidas nuevas se guardan en `docs/screenshots/v06/` y `docs/validation/v06/`.

La simulación de teclado/standalone y los eventos sintéticos verifican la implementación; **no equivalen a instalar en un iPhone/Android físico**. Comprobar tras publicar: Safari instalado con teclado real, barras dinámicas, rotación y accesibilidad; Chrome Android instalado con teclado real y pellizco en las zonas indicadas. No se ha publicado ni validado contra producción durante este trabajo. Los resultados ejecutados se detallan en [MONIGONES_V06_DELIVERY.md](MONIGONES_V06_DELIVERY.md).

Resultado final: 49 casos distintos de navegador aprobados, un histórico omitido y ningún fallo pendiente después de las reejecuciones. Detalle transparente de las ejecuciones y correcciones en [results.json](validation/v06/results.json).
