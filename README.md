# MONIGONES

**Construye tu club. Conquista la liga.**

Juego de gestión de fútbol con PWA vertical, ciudad deportiva, fantasy privado y servidor local persistente. Este repositorio implementa una partida multijugador local real; calendarios, resultados y economía deportiva se simulan. La integración completa de persistencia con Supabase todavía es una tarea pendiente: no basta con poner sus claves para sustituir SQLite.

## Rediseño 0.2

Ciudad isométrica con cámara libre, arrastre y pellizco, cinco arquitecturas para cada uno de los trece edificios mejorables, doce instalaciones ilustradas, interiores de departamentos, cartas de futbolistas, periódico deportivo y música/efectos originales. La columna sigue siendo vertical también en escritorio. En Ajustes puedes controlar audio, volumen, movimiento y calidad gráfica; la música comienza después de un gesto.

[Auditoría y límites](docs/REDESIGN_AUDIT.md) · [Guía de arte](docs/ART_DIRECTION.md) · [Capturas del juego](docs/screenshots/redesign/index.html) · [Galería de edificios](docs/building-gallery.html) · [Cobertura de pantallas](docs/SCREEN_COVERAGE.md) · [Pruebas del rediseño](docs/REDESIGN_TESTING.md).

Recursos deportivos: seis fotografías autorizadas de 390 identidades reales, 384 pendientes, 110 retratos ficticios y veinte emblemas alternativos ALT. Los escudos oficiales están pendientes de autorización. Créditos dentro del juego en Ajustes → Fotografías, emblemas y créditos, y en [SPORTS_ASSETS.md](docs/SPORTS_ASSETS.md). No se afirma cobertura completa ni resultados deportivos reales.

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
- Decisiones diarias, patrocinios, conciertos, cantera, relaciones institucionales, préstamos y sanciones ficticias.
- Chat compartido, periódico nacido de registros, seis tipos de eventos, entrenadores, clasificaciones, museos y archivo de temporadas.
- 500 futbolistas de los veinte clubes de referencia: 390 altas con fuente y 110 identidades ficticias. Todos los VM y resultados son simulados.

## Probar una semana en minutos

Con Real Corona, abre **Mi club → Ajustes y administración → Laboratorio de temporada**. Permite avanzar día, mercado, trabajos, partidos, jornada y semana. Cada paso reconcilia las mismas reglas de dominio que usa el servidor ordinario. El tiempo avanza para toda la liga. Estos controles se ocultan y se deniegan en servidor cuando están desactivados.

## Comandos

```sh
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

El [informe de entrega](docs/DELIVERY.md) distingue implementación probada, simulación, integración externa y desarrollo pendiente. Consulta también:

- [Diseño del juego](docs/GAME_DESIGN.md), [arquitectura](docs/ARCHITECTURE.md), [base de datos](docs/DATABASE.md).
- [Economía](docs/ECONOMY.md), [balance](docs/BALANCING.md), [árboles](docs/RESEARCH_TREES.md), [edificios](docs/BUILDINGS.md).
- [Datos deportivos y fuentes](docs/SPORTS_DATA.md), [recursos gráficos](docs/ASSETS.md).
- [Pruebas](docs/TESTING.md), [despliegue e instalación](docs/DEPLOYMENT.md).
- [Decisiones autónomas](docs/DECISIONS.md), [estado y trabajo pendiente](docs/ROADMAP.md).

No se han creado ni modificado proyectos remotos. El frontend de Cloudflare Pages está preparado; un despliegue del juego completo necesita un backend ejecutándose y persistencia duradera. Los SQL de `supabase/` son una base de migración, no una integración de producción ya verificada.
