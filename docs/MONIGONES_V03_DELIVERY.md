# Monigones v0.3 — Entrega

Fecha: 24 de octubre de 2026. Trabajo sobre v0.2 existente, sin reconstruir la partida ni modificar el catálogo deportivo, VM o puntuaciones. Implementación local; no se ha publicado ni aplicado una migración remota.

## 1. Resumen

Implementados: nueva ciudad raster en Canvas 2D; 15 espacios funcionales; cinco niveles de los 13 edificios mejorables; cámara limitada; retirada de banners; catálogo manual de PNG completo; chat adaptable; penalización de actividades únicamente cuando no se completa ninguna. Se conservan rutas, persistencia SQLite, multijugador, SSE, draft, mercado, convocatoria, investigaciones, patrocinios y conciertos.

La documentación distingue implementación, pruebas automatizadas, revisión visual y límites. No se atribuye calidad AAA al arte generado ni se presenta una silueta como fotografía real.

## 2. Cambios del mapa

Se sustituye el antiguo mapa SVG por un escenario urbano de 1600 × 2400, con barrio residencial y comercial, viales, aceras, plazas y campus deportivo. Estadio central; sede junto a oficinas; zona empresarial al norte; entrenamiento y cantera al este; museo e instituciones al sur. Los 15 espacios conservan su destino y sus avisos. Los elementos decorativos no son interactivos.

Niveles diferentes por arquitectura, anexos y cubiertas; obras ligadas a la cola real; afluencia ligada a la sede; ambiente de jornada y concierto. La primera revisión detectó una explanada trasera demasiado vacía y algunos edificios demasiado próximos: se añadieron infraestructura de aficionados, aparcamiento y autobús y se corrigieron las separaciones.

## 3. Motor gráfico elegido

Canvas 2D nativo con atlas WebP de alta resolución y transparencia. Ordenación por profundidad, DPR máximo 2, animación hasta 30 fps y decodificación previa. Enlaces DOM accesibles sobre los recortes del Canvas. Se evita introducir física, un motor de escenas o una dependencia innecesaria para este tamaño de mundo. Los detalles de edificio reutilizan el atlas en su viewport SVG; el mapa principal ya no es SVG.

Código: `src/components/CanvasCity.tsx`, `src/lib/visuals.ts`, `src/lib/v03-atlas-bounds.json`. Detalle en [MAP_GRAPHICS.md](MAP_GRAPHICS.md).

## 4. Recursos creados

Siete originales generados con la herramienta de imágenes integrada: `ground`, `core`, `training`, `commerce`, `relations`, `culture`, `props`. Originales PNG en `assets-source/art/v03`, versiones WebP en `public/art/v03`. Cinco atlas de 15 arquitecturas (75 variantes; 65 usadas para los 13 edificios mejorables y dos recortes fijos), una base urbana y seis grupos de infraestructura decorativa.

También se crean silueta y escudo genéricos SVG como fuente y sus PNG físicos. [Prompts exactos](V03_ART_PROMPTS.json). No se descargan nuevas fotos ni recursos de terceros; se conservan las siete fotografías previamente autorizadas.

## 5. Mejoras de realismo

Materiales de ladrillo, vidrio, piedra y metal; reflejos, maquinaria de cubierta, arbolado variado, aceras, aparcamiento, comercios, cruces y plazas. Luz superior izquierda y sombras coherentes en los recursos. Peatones y vehículos animados, aficionados y focos durante jornada/concierto. Los edificios se sitúan en parcelas pavimentadas y comparten el tratamiento artístico. La comparación visual muestra un cambio sustancial de representación, no un añadido de adornos al SVG anterior.

## 6. Límites de cámara

Todos los cambios pasan por `clampCamera`. Zoom mínimo adaptado al tamaño visible; límites por eje `[viewport − mundo × zoom, 0]`; centrado cuando el mundo es menor que la ventana. Retirado el antiguo margen exterior. Aplicado a arrastre, pellizco, rueda, teclado, centrado y redimensionado. Pruebas de extremos en 320, 390, 460 y ventanas mayores que el mundo, además de gestos reales del navegador.

## 7. Controles eliminados

Sin botones de acercar/alejar, porcentaje de zoom, vista general ni panel lateral. Se mantienen arrastre táctil/ratón, pellizco, rueda y selección de edificios. Umbral de 7 px y cancelación de clic durante el pellizco. Flechas, +/− y Home disponibles como alternativa de teclado sin interfaz flotante. Se conservan los accesos funcionales a actividades, eventos, periódico, obras y jornada.

## 8. Banners eliminados

Retirado del DOM el bloque «Tu club. Tu afición.», sin reemplazo decorativo. `DepartmentScene` deja de representar las grandes cabeceras ilustradas en todas las rutas. `PageTitle` usa título compacto, sin lema superior, y nombres funcionales como Mercado, Plantilla, Investigación, Patrocinios, Cantera y Entrenamiento. Se mantienen contadores, presupuestos, estados y acciones; no se consideran decorativos los contratos, plazos o la edición del periódico. Eliminado el fondo ilustrado de interiores.

## 9. Referencias medievales eliminadas

Marca visible: «Gestiona tu club. Compite en tu liga.». Se retiran la ilustración de reino de las rutas activas y los lemas épicos de cabeceras. Revisados textos y recursos de `src` y `shared`. Se mantienen por contexto **Real Corona** (nombre legítimo de un club demo), **Batalla** (apellido del portero), el ID de patrocinador `corona`, las claves históricas `crown-*` y los textos de comparación que migran mensajes antiguos a lenguaje futbolístico. La documentación histórica y los recursos antiguos conservados no se renombran para romper enlaces o partidas.

## 10. Sistema PNG

`shared/football-assets.json` contiene ID de jugador, ID de club real, nombre, identificador estable del recurso, archivo, fotografía y escudo. `shared/football-assets.ts` centraliza los 20 prefijos y los resolutores. Los componentes nunca adivinan el archivo a partir del nombre visible.

`PlayerPortrait`, `ClubBadge` y `LocalFootballImage` abastecen cartas, filas, plantilla, alineación, mercado, draft, convocatoria y demás vistas que ya representan jugadores. Una noticia sin retrato conserva su contenido; cualquier avatar representado usa el mismo sistema. Se conserva proporción, transparencia y fallback ante error.

## 11. Número de placeholders generados

**522 PNG físicos**: 500 jugadores, 20 escudos y dos fallbacks. Estado entregado: **493 siluetas de jugador, 7 fotografías autorizadas, 20 escudos genéricos y 2 fallbacks genéricos**. Las siete fotografías proceden de los recursos ya autorizados de v0.2, adaptados a lienzo 512 × 512. Los placeholders de jugador son 512 × 512 y los escudos 256 × 256. Las 110 identidades ficticias no reciben fotografías de otras personas.

## 12. Inventario de fotografías y escudos

[INVENTARIO_IMAGENES.csv](INVENTARIO_IMAGENES.csv): 520 filas más cabecera, con todas las columnas solicitadas. El validador comprueba firma PNG, estructura, descompresión, decodificación completa mediante ImageMagick, dimensiones, colisiones, cobertura e identidades. Clasifica por contenido: placeholder, fotografía autorizada cuyo hash coincide o aportación de usuario sin licencia verificada. No confunde un archivo modificado con la licencia anterior.

`npm run images:validate` actualiza CSV e informe sin cambiar las imágenes. Requiere `magick`; todos los archivos actuales han sido validados. `images:prepare` conserva imágenes existentes y crea únicamente las ausentes al preparar nuevas plantillas.

## 13. Funcionamiento de sustitución manual

Sustituir el PNG manteniendo el nombre basta. El servidor detecta cambios mediante metadatos de archivo y huella SHA-256; el navegador consulta cada 5 segundos y cambia la URL versionada. No requiere editar código, JSON, BD ni reconstruir el frontend. El servidor sirve la carpeta `public/assets/futbol` también en producción. La PWA usa NetworkFirst para PNG y conserva la última versión visitada; fallbacks precargados. Sin conexión no puede recibir archivos nuevos.

Prueba automática: sustitución temporal por una ilustración neutral de QA, detección con pantalla abierta en plantilla, mercado, ficha de producción y recarga PWA sin conexión, restaurando el original en `finally`. No se asigna la cara de otra persona. El club fantasy no participa en la ruta; el cambio real de club conserva el identificador y cambia el prefijo. El servidor reconoce los nombres válidos de transferencia sin reconstrucción. [Guía sencilla](COMO_AÑADIR_IMAGENES.md).

## 14. Chat corregido

Un único backend, historial, identidades y SSE conservados. Lista flex desplazable; compositor integrado con textarea multilínea de 46–112 px, botón táctil de 46 px, áreas seguras y altura basada en `visualViewport`. La navegación se oculta al reducirse el viewport por teclado. Se conserva el estado comprimido al pasar el foco a Enviar para que el botón no salte antes del clic. Borrador por liga/club en sessionStorage, incluido cerrar/reabrir el panel del periódico. Se mantienen avisos de cambios sin enviar y lectura por posición de scroll.

Probados mensajes cortos, largos, multilínea, envío, recepción entre presidentes, persistencia, scroll, borrador y límites del botón con viewport reducido, tanto en ruta como en periódico. El teclado es **emulado mediante reducción de viewport**, no una prueba física de teclado iOS/Android.

## 15. Nuevas reglas de actividades

Cero actividades cobradas: −1 fama. Una, dos o tres: sin penalización. Recompensas y costes intactos. Actividad pendiente al cierre: se aplaza la decisión de su día; al terminar y cobrar cuenta exactamente para el día de inicio. No consume propuestas nuevas ni concede premios automáticos. Las partidas anteriores inicializan la contabilidad con `dailyDone` e historial.

El reloj autoritativo sigue siendo el del servidor. Una actividad simultánea, cobro manual único y transacción serializada. Un pendiente antiguo no protege los días posteriores sin actividad. El cierre sigue las 06:00 de Madrid, incluyendo días de 23/25 horas.

## 16. Revisión de equilibrio

Se conservan las 20 definiciones, pesos 55/27/13/4/1 y rangos de 30 min–8 h. Tres propuestas estables por liga/día sin refresco. La legendaria cuesta 350.000 €, dura 8 h y ofrece 8 prestigio, 200 PD y 5 fama; sus 25 PD/h no dominan las comunes de desarrollo. Recoger tres propuestas es opcional; una basta para evitar la penalización. No se alteran reglas deportivas ni otras economías. Análisis y límites: [ACTIVITY_BALANCE.md](ACTIVITY_BALANCE.md).

## 17. Pruebas ejecutadas

Antes: 82 pruebas unitarias y 29 de navegador aprobadas, una captura histórica omitida intencionalmente; TypeScript, ESLint y build aprobados. Logs `docs/validation/v03/baseline-*`.

Después: `npm test`, `npm run check`, `npm run lint`, `npm run build`, `npm run images:validate` y `npm run test:e2e`. Se añaden 13 pruebas unitarias y tres pruebas de navegador que cubren varios casos cada una. Las pruebas anteriores se adaptan a Canvas, a los títulos compactos y a PNG; no se eliminan las verificaciones de negocio. La captura histórica sigue omitida para no sobrescribir su evidencia.

## 18. Resultados

La ejecución final se registra en `docs/validation/v03/*-final.log`. Estado de cierre: **95/95 pruebas unitarias y 32/32 pruebas de navegador aprobadas**, con una captura histórica omitida intencionalmente. La ejecución conjunta de navegador ha terminado en 3,6 minutos e incluye las 29 pruebas anteriores más las tres nuevas. TypeScript, ESLint y build de producción también aprobados.

| Comprobación                             | Resultado                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Unitarias/integración de dominio y Store | 95 aprobadas                                                          |
| Navegador, regresión y casos v0.3        | 32 aprobadas; 1 archivo histórico omitido                             |
| TypeScript                               | Aprobado                                                              |
| ESLint                                   | Aprobado                                                              |
| Build y generación de service worker     | Aprobado                                                              |
| PNG físicos, decodificación y catálogo   | 522 válidos; 500 jugadores, 20 clubes, 2 fallbacks                    |
| Revisión visual adicional                | 390 × 844, 320 × 568 y 1440 × 1100; sin errores JS ni desbordamientos |

El validador registra 500 jugadores, 20 clubes, 493 placeholders de jugador y 7 fotografías autorizadas, sin archivos inesperados. TypeScript, ESLint y build aprobados. No se han cambiado VM ni estadísticas para integrar imágenes. Bases de QA exclusivamente en `/tmp`; la partida del usuario no se usa como fixture.

## 19. Capturas

[Galería de revisión visual](screenshots/v03/index.html), con antes/después 390 × 844, niveles 1/5, vista general, jornada, plantilla provisional/sustituida, mercado, draft, alineación, convocatoria, chat, periódico, actividades y pantalla compacta de investigación. Capturas de teclado con viewport emulado 390 × 460 etiquetadas expresamente. Comprobación adicional 320 × 568 y escritorio 1440 × 1100 con columna centrada.

`regressions/` conserva la cobertura automatizada de rutas, instalaciones, obra, concierto, Safari/WebKit y Chrome Android. Las capturas históricas v0.2 se conservan intactas. Se revisan visualmente ciudad, nivel máximo, vista general, mercado, chat y tamaños reducidos, además de errores JavaScript y desbordamientos. El encuadre comparativo inicial conserva el estadio como foco y el mismo viewport, aunque el nuevo mundo cambia de proyección y distribución.

## 20. Problemas pendientes y límites

- No había imagen de referencia adjunta al texto; se adoptó una dirección moderna mediterránea original.
- El arte generado tiene pequeñas irregularidades de perspectiva y detalle. Es un salto visual sustancial frente al mapa anterior; no se presenta como acabado AAA ni geometría 3D exacta.
- Fotografías pendientes: 383 identidades reales aún genéricas, más 110 ficticias intencionalmente genéricas. Los 20 escudos son genéricos, preparados para la aportación manual.
- Teclado físico, instalación en un teléfono real y rendimiento en hardware de gama baja quedan sin verificar. Sí se prueba emulación móvil, WebKit, Chrome Android, movimiento reducido y viewport comprimido.
- La sustitución en caliente necesita el backend y acceso a su carpeta persistente. El modo sin conexión conserva lo visitado; no inventa actualizaciones.
- Los límites previos del proyecto, incluida la integración real de Supabase, no forman parte de este encargo. No se ha desplegado ni modificado ningún proyecto remoto.

## 21. Decisiones autónomas y motivos

1. **Canvas 2D y raster original**: salto de representación sin reconstruir el motor de reglas ni añadir un framework de física.
2. **Siete recursos originales con estilo común**: densidad y materiales coherentes; sin copiar edificios externos.
3. **Mundo y distribución nuevos**: estadio protagonista y departamentos agrupados; infraestructura adicional después de comparar capturas.
4. **DOM accesible sobre Canvas**: conservar navegación, avisos, teclado y selección sin dibujar botones de cámara.
5. **Mínimo de zoom adaptativo**: evitar exterior vacío por cualquier gesto y centrar ventanas excepcionalmente grandes.
6. **Cabeceras compactas centralizadas**: recuperar espacio útil en todas las rutas y conservar presupuestos/estados.
7. **IDs de recurso globalmente únicos y prefijo de club real**: evitar fotos equivocadas y separar transferencias reales de propiedad fantasy.
8. **522 PNG físicos y siete fotos autorizadas conservadas**: permitir sustitución inmediata sin descargar imágenes ni perder créditos existentes.
9. **Huellas de contenido y NetworkFirst**: reflejar cambios sin edición ni build, con continuidad offline de la última versión visitada.
10. **Créditos condicionados al contenido actual**: no atribuir a una aportación nueva la licencia de la foto sustituida.
11. **Textarea, visualViewport y borrador local**: resolver multilínea, teclado, clic de envío y continuidad del panel conservando el chat existente.
12. **Contabilidad por día de inicio**: corregir la penalización de una actividad larga sin cobros automáticos ni doble contabilización.
13. **Premios intactos y tres propuestas deterministas**: cumplir la regla solicitada y evitar un refresco explotable; documentar el balance sin cambiar economías ajenas.
14. **Bases temporales y evidencia versionada v03**: pruebas reproducibles sin tocar la partida ni sobrescribir capturas históricas.
