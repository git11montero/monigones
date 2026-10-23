# Auditoría del rediseño

## Situación inicial y conservación

React + TypeScript + Vite, PWA, Router, Query, API Node y SQLite. `shared/engine.ts` conserva el dominio autoritativo; `server/store.ts` aplica transacciones, sesiones, permisos e idempotencia. Se mantienen calendarios, mercado, contratos, obras, investigación, noticias y reconciliación. No se modifica el esquema ni se borra una partida. La base real del proyecto no se utiliza para pruebas gráficas.

Antes: mapa SVG estático con edificios repetidos, fondo crema/verde, tarjetas administrativas, ausencia de cámara y audio, retratos esquemáticos sin catálogo de derechos. Se ejecutaron 58 pruebas de dominio/persistencia, tipado, lint, compilación y nueve pruebas de navegador existentes; se guardaron 30 capturas históricas. Evidencia en `redesign-baseline/` y `screenshots/redesign/before/`.

Después: marca MONIGONES, atlas isométricos originales y cinco arquitecturas por edificio mejorable, cámara táctil, personajes y vehículos, estadio contextual, interiores ilustrados, dioramas de instalaciones, nuevas cartas, investigación por capítulos, periódico deportivo con artículos y columna satírica, sonido y preferencias. Todas las rutas anteriores permanecen. Se añade `/media` para créditos y cobertura; no hay equivalencias de rutas eliminadas que migrar.

## Cobertura

La tabla completa por ruta, arte, animación, acciones, pruebas y pendientes está en [SCREEN_COVERAGE.md](SCREEN_COVERAGE.md). El manifiesto automático de capturas está en `screenshots/redesign/route-coverage.json`. La galería de arquitectura ofrece también las variantes II y IV, además de las capturas de ciudad I/III/V.

## Defectos encontrados y resueltos

- Algunas celdas generadas mostraban parte del edificio vecino. Se midieron límites transparentes y se usan recortes SVG individuales.
- Estados de controles todavía usaban colores del tema anterior. Se corrigieron los selectores de mayor especificidad y la investigación pasó a flujo vertical real.
- Los atlas PNG originales excedían el límite por archivo del precache. Se guardan como fuentes y se distribuyen WebP; las fotografías utilizan caché bajo demanda.
- Una prueba anterior de préstamo suponía que los ingresos aleatorios de jornada no cubrirían su deuda. Su preparación asegura un descubierto; conserva la comprobación del saldo negativo y la devolución única. No se cambian reglas económicas.
- Las nuevas pruebas inicialmente consultaban opciones o fotografías antes de que acabara su carga. Se esperan las respuestas, títulos, imágenes decodificadas y opciones disponibles. La captura de una ficha aún en Suspense se sustituyó por una captura con contenido verificado.
- La prueba de invitación presentó un jugador de draft antes de invitar, incumpliendo una regla existente. Se corrigió el orden del recorrido: primero invitación, después draft.

## Límites reales

Fotografía parcial y cero escudos oficiales autorizados. Se conserva el proveedor simulado, sin un feed de resultados deportivos contratado. El motor de ciudad es pseudo-3D mediante sprites; los interiores son ilustraciones, no habitaciones 3D navegables. Parte de los niveles de departamentos no aporta un multiplicador económico en las reglas anteriores: se conserva y se indica.

Las pruebas móviles utilizan Chromium y WebKit automatizados con dispositivos emulados; no son mediciones en hardware Safari iOS o Chrome Android real. No se certifican FPS, consumo de batería ni permisos de marca mediante una captura. El arte y el sonido están integrados, pero no se afirma que equivalgan a una producción comercial con una banda sonora grabada y cientos de retratos licenciados.

Resultado final: tipado, lint, compilación, 69 unitarias y 21 e2e correctos. La prueba histórica se omite en ejecuciones posteriores. Fotografías y atlas se comprueban decodificados; el conjunto final conserva las capturas anteriores y añade la galería navegable.
