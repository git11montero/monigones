# Corrección de ERR_MODULE_NOT_FOUND en Vercel

## Causa comprobada

El artefacto anterior contenía `server/online/handler.js`, pero su entrada compilada `api/[...path].js` importaba `../server/online/handler`, sin extensión. Node ESM no busca automáticamente el archivo `.js`. La carga fallaba antes de entrar en el handler, por lo que afectaba a todas las rutas, incluso salud y sesión. Las dependencias del motor repetían el mismo patrón.

Se reprodujo el error importando el artefacto original con Node 22 y ejecutando la nueva prueba con Node **24.22.1**, que coincide con la versión principal `nodejs24.x` declarada por el artefacto. El build original terminaba correctamente: el fallo era de ejecución, no de ausencia del archivo trazado ni de las migraciones de Supabase.

La configuración principal de TypeScript usa `moduleResolution: Bundler`, adecuada para Vite y permisiva con imports sin extensión. Ni `tsc --noEmit` con esa configuración ni el cargador `tsx` detectaban la incompatibilidad. Node exige extensiones en imports relativos ESM: [documentación oficial](https://nodejs.org/api/esm.html#mandatory-file-extensions).

## Cambios

- Imports relativos con `.js` en `api/[...path].ts`, `server/online/{handler,store,transport}.ts` y los módulos compartidos alcanzados por la función (`activities`, `attention`, `config`, `engine`, `math`, `seed`, `sports`, `types`). Incluye imports de tipos para poder comprobar toda la cadena con NodeNext. El algoritmo del juego no cambia.
- `tsconfig.online.json` comprueba la función y sus dependencias con `module` y `moduleResolution: NodeNext`. `npm run check` y `npm run build:online` ejecutan esta comprobación. La configuración de Vite permanece igual.
- `scripts/test-vercel-artifact.mjs` descubre los directorios `.func`, comprueba la versión de Node, los copia fuera del repositorio y ejecuta el handler indicado en `.vc-config.json` en otro proceso. Copia las dependencias trazadas y desreferencia los enlaces para evitar que el checkout o su `node_modules` oculten archivos ausentes.
- `scripts/vercel-artifact-worker.mjs` importa el JavaScript con Node nativo y realiza 13 comprobaciones HTTP. Las respuestas de Supabase Auth y PostgREST proceden de un servidor HTTP temporal de localhost; las credenciales son ficticias. El proceso no hereda variables de producción, `NODE_OPTIONS`, `NODE_PATH` ni cargadores TypeScript. Las peticiones `fetch` del artefacto fuera del servidor de prueba fallan.
- Scripts `test:vercel-artifact` y `verify:vercel` para comprobar el resultado antes de publicar. ESLint ignora `.vercel/`, que contiene código generado y dependencias trazadas.

No se modifica `vercel.json`: la función ya se incluía correctamente. Todas las rutas `/api/health`, `/api/session`, `/api/command`, `/api/cron`, `/api/state`, `/api/leagues` y las restantes comparten esa única entrada. El proxy histórico de Cloudflare no tiene imports y no forma parte del artefacto de Vercel. El servidor SQLite sigue ejecutándose mediante `tsx` en modo local.

No se añaden archivos manualmente a `.vercel/output`: Vercel vuelve a generar todo desde los fuentes corregidos en cada build.

## Verificación del artefacto

Se ejecuta `npx vercel build --prod` con Vercel CLI 65.2.0. La salida inspeccionada es:

```text
.vercel/output/functions/api/[...path].func/
  .vc-config.json               runtime: nodejs24.x
  package.json                 type: module
  api/[...path].js              handler real de Vercel
  server/online/
    handler.js
    response.js
    store.js
    transport.js
  shared/
    activities.js
    attention.js
    config.js
    engine.js
    math.js
    research-stories.js
    seed.js
    sports.js
  node_modules/                Supabase SDK, @noble/hashes, zod y dependencias
```

La prueba falló con `ERR_MODULE_NOT_FOUND` sobre el artefacto anterior. Tras reconstruir desde los fuentes corregidos, el import nativo y las 13 comprobaciones HTTP pasaron en una copia temporal aislada. Incluyen salud mediante RPC, sesión anónima, sesión autenticada, token inválido, comando sin autenticación, comando autenticado sin liga, cron sin secreto y con secreto, estado, ligas, cierre de sesión, método inválido y ruta inexistente. También se comprueba que el SDK realiza las llamadas esperadas a Auth y a las RPC.

Estas comprobaciones prueban carga ESM, dependencias empaquetadas y ejecución de rutas. Los fixtures HTTP no sustituyen a Supabase remoto ni ejecutan sus servicios oficiales. Las operaciones y permisos PostgreSQL se comprueban por separado en un clúster local desechable; ninguna prueba utiliza la base remota ni las partidas SQLite del usuario.

Resultados y huellas del artefacto: [evidencia local](validation/vercel-runtime/results.json).

También pasaron `npm run check` (configuración general y NodeNext), ESLint, 95 pruebas unitarias, 20 pruebas de integración PostgreSQL y el build local. La suite completa Playwright pasó con 32 pruebas correctas y una captura histórica omitida, incluyendo PWA offline, Safari, Android, imágenes y multijugador local. En una primera ejecución de esa suite, un build online concurrente cambió `dist` y provocó un fallo en la prueba de sustitución de imágenes de la PWA local. Se reconstruyó el modo local y se repitió la suite completa sin builds concurrentes: pasó. Para repetirla, ejecuta `npm run build` antes de `npm run test:e2e` y construye online después. Las capturas regeneradas por las pruebas se restauraron; no se entregan cambios gráficos.

## Volver a publicar

En el proyecto Vercel existente, conservando sus variables actuales:

```sh
cd /Users/montero/Proyectos/juego-futbol
npx vercel pull --yes --environment=production
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
# Solo después de pasar la prueba y decidir publicar:
npx vercel deploy --prebuilt --prod
curl --fail https://monigones.vercel.app/api/health
curl --fail https://monigones.vercel.app/api/session
```

`pull` descarga configuración y variables a `.vercel/` (ignorada por Git); no elimina ni cambia variables remotas. No se necesitan migraciones para esta corrección. Con Node 24 instalado, `npm run verify:vercel` sustituye las órdenes de build y prueba. Si cambia `runtime` en `.vc-config.json`, utiliza la misma versión principal para probar.

La preparación local no incluye despliegue, cambios en Supabase ni llamadas de comprobación a la API remota. Tras publicar, salud debe responder `ok: true, mode: supabase-postgresql` y sesión sin token debe responder `user: null`. La validación del despliegue remoto queda pendiente de esos pasos.
