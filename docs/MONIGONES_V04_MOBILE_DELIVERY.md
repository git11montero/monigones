# Monigones v0.4 · experiencia móvil y PWA

Preparación local del 24/10/2026. No se ha desplegado, modificado Supabase remoto, activado Cron, importado datos ni abierto la partida SQLite del usuario. Se mantienen las reglas y la arquitectura online Vercel Functions + Supabase.

## 1. Diagnóstico del navegador normal

Hay un defecto comprobable en v0.3: `vite.config.ts` utilizaba Workbox con HTML/JS precacheados, `navigateFallback: /index.html` y actualización `prompt`. `src/main.tsx` emitía `crown:update`, pero ninguna interfaz lo consumía y no se conservaba la función que permite aplicar la actualización. Un worker antiguo podía seguir sirviendo un frontend antiguo tras publicar otro correcto. Una ventana sin ese worker recibía el frontend nuevo.

La URL y la clave pública de Supabase se incorporan al JS durante la compilación; no se recuperan de una partida, React Query ni las preferencias. `getSupabase()` valida esos valores antes de crear el cliente. El almacenamiento de Auth puede contener una sesión antigua, pero no puede eliminar las constantes de un paquete ya compilado. El caché de sesión y los snapshots online ya están separados de SQLite por proyecto/usuario; se conservan.

La prueba `tests/e2e/updates.spec.ts` reproduce el mecanismo con un perfil Chromium persistente, un worker **real generado por Workbox** con el comportamiento anterior y una pantalla deliberadamente obsoleta que muestra el error de configuración. Después sirve los builds reales actuales y comprueba la recuperación sin borrar el perfil. Es una reproducción controlada del defecto; **no he inspeccionado el almacenamiento de tu navegador normal ni puedo certificar qué paquete exacto tenía instalado**. El dominio de producción no ha sido modificado.

## 2. Actualización y recuperación

- `src/sw.ts` es un worker propio compilado con `injectManifest`. Cada build tiene una identidad compartida por HTML/JS/worker y `version.json`.
- Instala el conjunto completo de recursos antes de activarse; si falla un recurso, descarta únicamente el shell incompleto y conserva el anterior.
- Se activa sin `clients.claim()`: las páginas abiertas continúan con su código y recursos. Las siguientes navegaciones reciben el shell nuevo. Esto permite recuperar también clientes v0.3 que carecían de botón de actualización.
- `src/lib/updates.ts` comprueba al abrir, recuperar foco/visibilidad/conexión y cada cinco minutos visibles con conexión. Usa `updateViaCache: none`.
- El aviso **«Nueva versión disponible — Actualizar»** no recarga por sí solo. Una actualización en otra pestaña tampoco interrumpe formularios. Los borradores registrados de chat, oferta e identidad disponen de protección `beforeunload`; cancelar conserva el texto y permite volver a pulsar Actualizar.
- Se mantienen los shells anteriores mientras haya ventanas de una versión antigua o desconocida. Se borran solo shells de Monigones y el precaché Workbox legado del mismo scope cuando las ventanas restantes confirman la versión actual. No se borran Auth, preferencias, IndexedDB, snapshots ni cachés de otras aplicaciones.
- Un recurso de ruta retirado muestra recuperación y deja accesible el control de actualización; no hay recargas automáticas ni bucles.
- `vercel.json` exige revalidación del HTML y rutas del juego, worker, manifest y versión. Las API mantienen `no-store`; los PNG conservan su estrategia NetworkFirst y nombres.
- `build:online` verifica también el **resultado compilado**: configuración pública presente, identidad compartida y existencia de todos los recursos precacheados. Rechaza configuración ausente o privada antes de compilar, sin imprimir sus valores.

En la primera transición desde v0.3, un documento ya cargado no puede adquirir retroactivamente una interfaz nueva. El navegador instalará el worker nuevo y la siguiente apertura/navegación normal recuperará el juego; no hace falta incógnito ni borrar datos. Desde v0.4 el aviso permite hacerlo explícitamente.

## 3. Meta, manifest y áreas seguras

Añadido `mobile-web-app-capable=yes`, conservando los dos meta Apple y `apple-touch-icon`. Se mantienen inicio y scope `/`, `display: standalone`, orientación vertical, iconos 192/512 y maskable, tema y fondo. Los PNG existentes permanecen intactos. La cabecera se mide para que el mapa y el chat aprovechen el espacio liberado y respeten las áreas seguras.

## 4. Gestos

La superficie del juego usa `touch-action: pan-y`: permite listas y formularios verticales e impide pinch/doble toque accidental sobre la interfaz. El mapa conserva `touch-action: none`, Pointer Events, captura, cámara limitada, pellizco interno, arrastre y teclado. La selección desde la etiqueta utiliza el mismo acceso del edificio; un arrastre o cancelación no abre destinos. Se mantienen las ampliaciones accesibles mediante controles del navegador: no se introducen `user-scalable=no` ni `maximum-scale`. Los campos tienen al menos 16 px para evitar el zoom de enfoque de iOS.

## 5. Audio

Música y efectos activos por defecto, volumen 35 %. Un silencio o volumen guardados siguen teniendo prioridad. Un único gestor se inicia antes del login y desbloquea el contexto mediante un gesto real. Usa síntesis Web Audio existente, sin nuevos formatos, rutas ni descargas. Reanuda suspensión/interrupción al volver a primer plano; si el sistema exige otro gesto, el siguiente toque reintenta. Solo crea otro contexto si el anterior está cerrado. Mantiene una sola secuencia musical al navegar y detiene audio en segundo plano. No intenta evitar autoplay, silencio ni restricciones del dispositivo.

## 6. Instalación

Detección mediante display-mode, `navigator.standalone` y `appinstalled` cuando existe. La invitación automática se limita a móviles y espera una Ciudad sin formulario activo ni otro diálogo. Tiene el título y descripción solicitados, icono, ventajas, instrucciones por plataforma, Ahora no y No volver a mostrar. Ahora no aplaza al menos un día y la sesión actual; Nunca se guarda localmente. También se puede abrir desde Ajustes.

El evento Android se captura desde el arranque, pero `prompt()` solo se invoca al pulsar Instalar. Se consume una única vez. Si no existe, se ofrecen las alternativas del menú sin prometer una etiqueta universal. iOS explica Safari → Compartir → Añadir a pantalla de inicio → Abrir como app web si aparece → confirmar. Los navegadores sin las mismas APIs reciben instrucciones manuales.

No existe una API universal para saber desde una pestaña ordinaria si una app ya está instalada en otra ventana. Se detecta el modo de ejecución y los eventos disponibles; no se simula una instalación efectiva.

## 7. Recursos y cabecera

Retirada la barra permanente de tesorería, PD y medallas. Mi club muestra esos saldos, fama, prestigio y afición, con iconos, formato y control de ocultación. Mercado conserva fondos disponibles/reservados y costes; obras e investigación incluyen saldos contextuales de dinero/PD y sus costes existentes. No cambian reservas ni reglas económicas. La cabecera conserva nombre, escudos, sonido y noticias; el mapa gana altura.

## 8. Ciudad y avisos

Mapa/Secciones recuerda la última elección en este dispositivo. Las cuatro categorías incluyen los quince edificios reales exactamente una vez. Cada acceso presenta su gráfico existente, nombre, nivel cuando corresponde, disponibilidad/obra, cuenta atrás y avisos. `city-access.ts` comparte destinos y selección de obras entre vistas; abrir sigue pasando por las mismas pantallas y validaciones existentes.

Los contadores del mapa están dentro de `.building-label`, junto al texto y nivel; en secciones, dentro del nombre. Son parte de la misma transformación y del orden del edificio y no interceptan eventos. Se reutiliza `AttentionBadge`; no hay otro sistema de notificaciones ni generación de eventos.

## 9. Archivos

- Arranque/PWA: `index.html`, `vite.config.ts`, `vercel.json`, `src/main.tsx`, `src/env.d.ts`, `src/sw.ts`, `src/lib/updates.ts`, `src/lib/install.ts`, `src/components/MobileExperience.tsx`.
- Experiencia: `src/App.tsx`, `src/game.css`, `src/lib/audio.ts`, `src/components/Experience.tsx`, `src/components/UnsavedChanges.tsx`.
- Ciudad/recursos: `src/lib/city-access.ts`, `src/components/CitySections.tsx`, `src/components/CanvasCity.tsx`, `src/components/ResourceVisibility.tsx`, `src/pages/{CityPage,SettingsPage,BuildingsPage,ResearchPage}.tsx`.
- Build: `scripts/build-online.mjs`, `scripts/verify-pwa-build.mjs`, versión 0.4.0 en package/lock y dependencia explícita Workbox para la prueba del comportamiento anterior.
- Pruebas: `tests/mobile.test.ts`, `tests/build-output.test.ts`, `tests/e2e/{v04,updates}.spec.ts`, adaptación de expectativas en v02/redesign/visual-systems, `playwright.config.ts` y ampliación del escenario de navegador PostgreSQL para caducidad de sesión y diagnóstico del worker. Las pruebas anteriores permanecen.

## 10. Validación

Resultados finales y logs sin credenciales: [results.json](validation/v04/results.json) y [validation/v04](validation/v04/).

| Comprobación | Resultado real |
| --- | --- |
| TypeScript principal y backend online | Correcto (`npm run check`) |
| ESLint | Correcto |
| Unitarias | **142 correctas**, 11 archivos |
| PostgreSQL | **41 correctas**, 2 archivos; clúster local desechable |
| Navegador | **38 correctas**, 1 omitida histórica que ya existía |
| Motores y tamaños | Chromium y WebKit; cuatro móviles y escritorio centrado |
| Build local | Correcto, worker con 51 recursos precacheados |
| Build online aislado | Correcto; configuración pública comprobada en el JS compilado |
| `npx vercel build --prod` | Correcto, exclusivamente construcción local |
| Function construida | **36 comprobaciones HTTP correctas** con Node **24.22.1**, ESM nativo fuera del repositorio, runtime declarado `nodejs24.x` |
| Frontend del artefacto Vercel | HTML/JS/worker con versión compartida; todos los 51 recursos presentes |
| PNG publicados en el artefacto | **522 idénticos byte por byte** a `public/assets/futbol` |

La actualización se probó con perfil persistente, contexto limpio, worker Workbox antiguo, dos builds reales v0.4, varias ventanas, simulación standalone, instalación incompleta, cancelación/aceptación del aviso y conservación del borrador. No hubo recargas automáticas ni bucles. PostgreSQL incorpora además la renovación de un JWT caducado con refresh válido y el retorno al login con refresh revocado usando el SDK y los fixtures locales. Se conservaron las pruebas existentes y se restauraron sus capturas históricas tras guardar evidencia v0.4 aparte. La revisión visual detectó y corrigió la capa del selector sobre el modal de instalación; después se repitieron **los 6 escenarios móviles/PWA**, todos correctos, con una aserción de solapamiento y capturas actualizadas. Se regeneró también el artefacto Vercel final.

La suite PostgreSQL se ejecuta **únicamente en un clúster nuevo y temporal de localhost**, con la autorización expresa previa del usuario para ese procedimiento. El script crea y elimina su propio directorio. Sus migraciones son las existentes; no se han creado ni ejecutado cambios contra bases remotas ni la partida del usuario. Usa PostgreSQL real, SDK Auth real y emulación de los protocolos Auth/Realtime: no sustituye validar GoTrue, correo ni el servicio Realtime alojados.

La comprobación del artefacto Vercel carga la Function construida fuera del repositorio usando Node del mismo major que su runtime, y efectúa peticiones contra fixtures locales. El build local y el online se conservan como modos separados; no se arranca SQLite para producción online.

## 11. Capturas

[Galería móvil y escritorio](screenshots/v04/index.html): Mapa, Secciones y Mi club en 320×568, 375×812, 390×844, 430×932 y escritorio 1440×1000; invitaciones iOS/Android. Capturas de navegadores automatizados con datos temporales, no del usuario ni de sus dispositivos físicos.

## 12. Uso y publicación posterior

No hay nuevas variables ni migraciones. Se conservan las variables de Supabase de producción existentes. Para revisar localmente:

```sh
npm ci
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
# Requiere PostgreSQL 17+ local; crea y elimina un clúster de pruebas propio:
npm run test:postgres
# Usa las variables públicas existentes o .env.online.local (nunca una clave secreta VITE_):
npm run build:online
npx vercel build --prod
# Usa Node 24 cuando .vc-config.json indique nodejs24.x:
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
node scripts/verify-pwa-build.mjs .vercel/output/static
```

El build online sobrescribe `dist`; para ejecutar otra vez la PWA SQLite local, vuelve a hacer `npm run build` antes de `npm start`. `npm run dev` mantiene el modo local de desarrollo.

**Solo cuando decidas publicar** y desde el repositorio vinculado con las variables ya configuradas:

```sh
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
node scripts/verify-pwa-build.mjs .vercel/output/static
npx vercel deploy --prebuilt --prod
```

El último comando sí modifica producción: **no se ha ejecutado**. También puedes publicar mediante el flujo Git habitual de tu proyecto. No necesitas repetir importaciones, migraciones ni configurar Cron para esta entrega. Después de publicar, abre una ventana normal ya usada, deja que detecte el worker y prueba Actualizar/reapertura conservando la sesión.

Los PNG se actualizan en `public/assets/futbol` con su nombre actual, `npm run images:validate`, `npm run images:manifest`, build y publicación. No edites `.vercel/output` ni escribas archivos permanentes desde Functions. Detalles en [COMO_AÑADIR_IMAGENES.md](COMO_AÑADIR_IMAGENES.md) y [ONLINE_SETUP.md](ONLINE_SETUP.md).

## 13. Pendiente de validación física y remota

No se han utilizado teléfonos físicos. Chromium móvil, WebKit y la simulación standalone verifican código, gestos y UI, pero no prueban una instalación del sistema operativo, salida por altavoces, interruptor de silencio, llamadas, bloqueo de pantalla ni teclado nativo de iOS. Esas comprobaciones quedan para iPhone/Safari/PWA y Android/Chrome/PWA tras publicar con autorización. No se afirma que las nuevas cabeceras o el worker estén ya en el dominio público. El shell online ocupa aproximadamente 9,5 MiB; durante una actualización pueden convivir varias versiones en el almacenamiento del navegador. Se usa la transferencia del Vercel existente, sin añadir servicios ni planes de pago. La disponibilidad de sonido y `beforeinstallprompt` depende del navegador y sus políticas.

## 14. Decisiones autónomas

1. Cambiar a un worker con manifiesto inyectado para recuperar clientes v0.3 sin forzar páginas abiertas ni borrar Auth.
2. Activación para la siguiente navegación y actualización explícita, conservando recursos de otras ventanas.
3. Identidad única por build y verificación de artefactos, sin guardar claves en el informe.
4. Control de gestos en superficies, conservando zoom accesible y edición nativa.
5. Música activa solo para preferencias ausentes, manteniendo silencio existente y contexto único.
6. Invitación de instalación tras acceder a Ciudad, aplazamiento de un día y opción permanente por dispositivo.
7. Cuatro categorías y accesos compartidos para las quince instalaciones; ningún cambio de reglas.
8. Reutilizar recursos gráficos existentes y pruebas previas; capturas v0.4 separadas del archivo histórico.
9. Mantener intactos backend, migraciones, datos y servicios alojados; toda validación usa fixtures y partidas desechables.

Referencias técnicas: [ciclo y activación del worker](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting), [clients.claim](https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim), [actualizaciones y formularios](https://vite-pwa-org.netlify.app/guide/auto-update), [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action), [AudioContext e interrupciones iOS](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state), [instalación y compatibilidad](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
