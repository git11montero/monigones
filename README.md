# MONIGONES

**Gestiona tu club. Compite en tu liga.**

Juego de gestión de fútbol con PWA vertical, ciudad deportiva, fantasy privado y servidor local persistente. Este repositorio implementa una partida multijugador local real; calendarios, resultados y economía deportiva se simulan. La integración completa de persistencia con Supabase todavía es una tarea pendiente: no basta con poner sus claves para sustituir SQLite.

## Monigones v0.3

Nueva ciudad en Canvas 2D con siete recursos raster originales, cámara limitada al escenario y cinco niveles de arquitectura. Pantallas compactas sin banners decorativos, chat multilínea adaptable al teclado y nueva regla de actividades: solo cero actividades completadas supone −1 fama, aplazando la decisión si hay una actividad pendiente de ese día.

Incluye 522 PNG locales: 500 jugadores, 20 escudos y 2 fallbacks. Puedes sustituir cada archivo manteniendo su nombre; el servidor detecta su contenido y actualiza la imagen sin editar código ni reconstruir el frontend. Se conservan siete fotografías autorizadas; las demás imágenes de jugador y todos los escudos son genéricos.

[Entrega v0.3](docs/MONIGONES_V03_DELIVERY.md) · [Galería antes/después](docs/screenshots/v03/index.html) · [Cómo añadir imágenes](docs/COMO_AÑADIR_IMAGENES.md) · [Inventario CSV](docs/INVENTARIO_IMAGENES.csv) · [Motor gráfico](docs/MAP_GRAPHICS.md) · [Actividades y balance](docs/ACTIVITY_BALANCE.md).

## Mejoras Monigones v0.2

Avisos persistentes entre sesiones, selectores personalizados, actividades de 30 minutos a 8 horas con recogida manual, recursos ocultables, chat dentro del periódico, explicaciones de las 49 tecnologías y confirmaciones de cancelación. El mapa incorpora un vial conectado, plazas, campos de cantera, aparcamiento y una evolución ambiental ligada al nivel de la sede.

[Entrega y estado de las mejoras](docs/MONIGONES_V02_DELIVERY.md) · [Antes/después y capturas](docs/screenshots/v02/index.html) · [Auditoría de fotografías](docs/PLAYER_PHOTOS_AUDIT.md) · [Auditoría Supabase](docs/SUPABASE_MIGRATION_AUDIT.md).

La migración de Supabase supera el análisis estático; su ejecución y pruebas de RLS en PostgreSQL siguen pendientes. No se ha aplicado a ninguna base remota.

## Base visual

Ciudad isométrica con cámara libre, arrastre y pellizco, cinco arquitecturas para cada uno de los trece edificios mejorables, doce instalaciones ilustradas, títulos compactos de departamentos, cartas de futbolistas, periódico deportivo y música/efectos originales. La columna sigue siendo vertical también en escritorio. En Ajustes puedes controlar audio, volumen, movimiento y calidad gráfica; la música comienza después de un gesto.

[Auditoría y límites](docs/REDESIGN_AUDIT.md) · [Guía de arte](docs/ART_DIRECTION.md) · [Capturas del juego](docs/screenshots/redesign/index.html) · [Galería de edificios](docs/building-gallery.html) · [Cobertura de pantallas](docs/SCREEN_COVERAGE.md) · [Pruebas del rediseño](docs/REDESIGN_TESTING.md).

Recursos deportivos: siete fotografías autorizadas de 390 identidades reales, 383 pendientes, 110 siluetas de identidades ficticias y veinte escudos genéricos PNG. Los escudos oficiales están pendientes de autorización. Créditos dentro del juego en Ajustes → Fotografías, emblemas y créditos, y en [PLAYER_PHOTOS_AUDIT.md](docs/PLAYER_PHOTOS_AUDIT.md). No se afirma cobertura completa ni resultados deportivos reales.

## Arrancar

Requiere Node **22.22 o posterior** y npm. Las dependencias están fijadas en `package-lock.json`.

```sh
npm ci
npm run dev
```

Abre **http://localhost:5173**. El servidor de reglas escucha en `127.0.0.1:3001`. La aplicación necesita ambos procesos; el comando los arranca juntos. Entra con **«Entrar a la partida de demostración»**. El selector permite elegir uno de seis presidentes. Real Corona es el administrador. Usa ventanas privadas o perfiles de navegador diferentes para manejar varios presidentes a la vez.

Los cambios se guardan en `data/crown.sqlite`. Cerrar y abrir el navegador o reiniciar el servidor conserva la partida. No borres ese archivo para actualizar el código. Haz copias con el servidor parado, o mediante la herramienta de backup de SQLite.

También puedes registrar una cuenta local, fundar una liga e invitar a tus amigos antes del draft. Las cuentas normales usan contraseñas con scrypt y sesiones con cookies HttpOnly. Los usuarios demo son identidades de prueba deliberadamente seleccionables.

## Qué se puede jugar

- Draft público con presupuesto de 100 M€, adjudicación única y prima final de 20 M€; subastas especiales con prórroga.
- Mercado diario compartido de cinco jugadores, pujas secretas, salario ofrecido, aceptación, reservas de saldo y auditoría.
- Compra, venta, propuestas, contraofertas, intercambios, cesiones, blindajes, cláusulas y renegociación, con requisitos.
- Once, formaciones, banquillo, convocatoria automática, sustituciones, calidad de casillas, felicidad, jornadas y liquidaciones.
- 15 espacios de ciudad, 12 instalaciones, obras cancelables, colas y 49 tecnologías en exactamente tres árboles.
- Tres propuestas de actividades temporizadas al día, patrocinios, conciertos, cantera, relaciones institucionales, préstamos y sanciones ficticias.
- Chat compartido, periódico nacido de registros, seis tipos de eventos, entrenadores, clasificaciones, museos y archivo de temporadas.
- 500 futbolistas de los veinte clubes de referencia: 390 altas con fuente y 110 identidades ficticias. Todos los VM y resultados son simulados.

## Probar una semana en minutos

Con Real Corona, abre **Mi club → Ajustes y administración → Laboratorio de temporada**. Permite avanzar día, mercado, trabajos, actividades, partidos, jornada y semana. Cada paso reconcilia las mismas reglas de dominio que usa el servidor ordinario. El tiempo avanza para toda la liga. Estos controles se ocultan y se deniegan en servidor cuando están desactivados.

## Comandos

```sh
npm run images:validate
npm run images:prepare
npm run sports:assets
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
npm run simulate
npm run catalogs
npm run sports:validate -- data/import-example.json
npm run format
```

`test:e2e` necesita Chromium de Playwright (`npx playwright install chromium webkit` si no existe). Usa servidores aislados en 5174, 3101 y 3102 y bases de prueba en `/tmp`; no toca tu partida. Ejecuta `npm run build` antes de las pruebas PWA. `simulate` recorre 38 jornadas en tres escenarios y escribe `docs/simulation-results.json`.

Para probar el artefacto PWA de producción local:

```sh
npm run build
CROWN_DEMO=true CROWN_ADMIN_TOOLS=true npm run start
```

Abre http://localhost:3001. En producción normal ambas opciones están desactivadas por defecto. La instalación en un móvil remoto requiere HTTPS; `localhost` es excepción de desarrollo del navegador.

## Documentación

El [informe actual de entrega](docs/MONIGONES_V03_DELIVERY.md) distingue implementación probada, integración externa y desarrollo pendiente. El [informe inicial](docs/DELIVERY.md) conserva la historia de la primera versión. Consulta también:

- [Diseño del juego](docs/GAME_DESIGN.md), [arquitectura](docs/ARCHITECTURE.md), [base de datos](docs/DATABASE.md).
- [Economía](docs/ECONOMY.md), [balance](docs/BALANCING.md), [árboles](docs/RESEARCH_TREES.md), [edificios](docs/BUILDINGS.md).
- [Datos deportivos y fuentes](docs/SPORTS_DATA.md), [recursos gráficos](docs/ASSETS.md).
- [Pruebas](docs/TESTING.md), [despliegue e instalación](docs/DEPLOYMENT.md).
- [Decisiones autónomas](docs/DECISIONS.md), [estado y trabajo pendiente](docs/ROADMAP.md).

No se han creado ni modificado proyectos remotos. El frontend de Cloudflare Pages está preparado; un despliegue del juego completo necesita un backend ejecutándose y persistencia duradera. Los SQL de `supabase/` son una base de migración, no una integración de producción ya verificada.
