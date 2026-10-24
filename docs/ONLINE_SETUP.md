# Conectar Monigones a Supabase y Vercel

Este documento contiene comandos para que el propietario los ejecute **cuando autorice los cambios remotos**. Durante la preparación no se ha enlazado, migrado ni desplegado ningún proyecto remoto. El nombre «Monigones» y la región Irlanda no permiten deducir su project ref: cópialo del Dashboard; no lo sustituyas por el nombre de la aplicación.

## 1. Dos modos independientes

| Modo            | Arranque                                    | Persistencia y sincronización                                           |
| --------------- | ------------------------------------------- | ----------------------------------------------------------------------- |
| Local existente | `npm run dev`                               | Node local, SQLite y SSE; partida en `data/crown.sqlite`                |
| Online          | `npm run build:online`, publicado en Vercel | Vercel Function, Supabase PostgreSQL, Auth y Realtime; cron en Supabase |

La versión online no abre SQLite, no importa el servidor permanente y no escribe archivos persistentes en Vercel. No se transfieren automáticamente usuarios, contraseñas, demos ni partidas SQLite a Supabase: se conservan localmente y las ligas online se fundan con cuentas Supabase. Los controles de reloj e importación del laboratorio siguen disponibles localmente; no se activan en producción.

## 2. Verificar la preparación local

Node 22.22+, npm y navegadores Playwright:

```sh
cd /Users/montero/Proyectos/juego-futbol
npm ci
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
npm run images:validate
```

Las pruebas de navegador levantan sus propios servidores y bases SQLite temporales; no utilizan la partida del usuario. Si faltan los navegadores, ejecuta `npx playwright install chromium webkit`.

Para ejecutar todas las migraciones, el seed y la integración PostgreSQL en una instancia **nueva y desechable**:

```sh
brew install postgresql@17
MONIGONES_PG_BIN="$(brew --prefix postgresql@17)/bin" npm run test:postgres
```

No arranca un servicio PostgreSQL permanente. El script crea un clúster y puerto temporales, aplica todos los archivos ordenados de `supabase/migrations`, ejecuta las pruebas y destruye únicamente su propio clúster. En Linux puedes usar un PostgreSQL 17 instalado y definir `MONIGONES_PG_BIN` con su carpeta `bin`, ejecutando las pruebas como usuario sin privilegios root.

La prueba incorpora tres sesiones Chromium, dos ligas, el SDK Supabase, PostgreSQL real y PWA offline. Auth y WebSocket usan fixtures locales explícitos: **no es una ejecución completa de GoTrue/PostgREST/Realtime oficiales**. La configuración para un stack Supabase local está en `supabase/config.toml`; `supabase start` requiere Docker. Ese stack completo no se ha levantado en esta preparación porque Docker no está instalado.

## 3. Variables necesarias

Plantilla: [.env.online.example](../.env.online.example). Para compilar online en tu ordenador puedes copiarla a `.env.online.local`, que está ignorado por Git. No reemplaces el `.env` del modo SQLite.

| Variable                        | Dónde                   | Valor                                                  |
| ------------------------------- | ----------------------- | ------------------------------------------------------ |
| `VITE_SUPABASE_URL`             | Build del frontend      | URL del proyecto Supabase                              |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Build del frontend      | Clave `sb_publishable_…`; pública                      |
| `SUPABASE_URL`                  | Vercel Function         | La misma URL                                           |
| `SUPABASE_SECRET_KEY`           | Vercel Function         | Clave `sb_secret_…`; privada                           |
| `MONIGONES_CRON_SECRET`         | Vercel Function y Vault | Secreto independiente de al menos 32 caracteres        |
| `PUBLIC_ORIGIN`                 | Vercel Function         | `https://monigones.vercel.app`                         |
| `VITE_BACKEND`                  | Build                   | `build:online` lo fija a `supabase`; local usa `local` |

Se admiten `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` como alternativas antiguas. Las claves nuevas se envían en `apikey`; un JWT de usuario se envía en Authorization. No pongas la clave privada ni el secreto cron en ninguna variable `VITE_*`. El build online rechaza nombres públicos de secretos y claves privadas reconocibles.

Para generar el secreto cron, usa `openssl rand -hex 32`, guárdalo en tu gestor de contraseñas y después introdúcelo en los formularios interactivos de Vercel y Vault. No lo incluyas en comandos guardados en el historial, código ni commits.

```sh
cp .env.online.example .env.online.local
# Rellena únicamente tu copia local ignorada por Git.
npm run build:online
```

## 4. Aplicar las migraciones al proyecto correcto

Estos pasos modifican el Supabase remoto; **no se han ejecutado**.

1. En el Dashboard abre el proyecto **Monigones**, comprueba la organización y la región y copia su project ref y URL.
2. Revisa si tiene tablas o migraciones previas. Si contiene datos, realiza una copia antes de aplicar cambios. No uses `db reset`, no borres tablas y no repares el historial para ocultar errores.
3. Enlaza el checkout con ese proyecto y revisa el plan:

```sh
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase migration list
supabase db push --dry-run
```

4. Con el plan revisado y autorizado:

```sh
supabase db push
```

Se esperan `202610230001_crown.sql` y `202610240001_online.sql`. La primera conserva el esquema normalizado histórico. La segunda activa el adaptador JSONB privado, añade la membresía del club, RPC privadas, permisos, tabla de revisiones y publicación Realtime. Si la primera ya está registrada correctamente, Supabase la omite. Si existen tablas sin historial compatible, detente y revisa esa diferencia; no fuerces su recreación.

El juego online obtiene sus 500 jugadores y definiciones del motor compartido al fundar una liga. **No necesita ejecutar el seed de pruebas en producción.** `supabase/seed.sql` se valida localmente y sirve para pruebas del esquema normalizado. No contiene ni sustituye partidas online.

## 5. Configurar Supabase Auth

En Authentication:

- Activa Email/Password y permite altas si quieres que los amigos creen sus cuentas.
- Site URL: `https://monigones.vercel.app`.
- Redirect URL autorizada: `https://monigones.vercel.app/`.
- Establece una contraseña mínima de diez caracteres, coherente con el formulario existente.
- Decide cómo entregar las confirmaciones por correo antes de invitar a usuarios.

El SMTP incluido por defecto está limitado y no equivale a un servicio de correo público para todos los jugadores. Para conservar confirmación por correo configura SMTP propio; hay proveedores con planes gratuitos, que pueden requerir un dominio verificado. Para una prueba privada sin SMTP puedes desactivar Confirm email, aceptando que esas direcciones **no estarán verificadas**. Esta elección se hace en tu proyecto; el código soporta ambos casos y no la cambia automáticamente. [Documentación oficial de SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

El navegador conserva y renueva su sesión mediante el SDK. La API verifica el token con `Auth.getUser`, obtiene el ID del servidor de Auth y busca su membresía. Ignora los campos de identidad o privilegios que intente incluir un comando. Cerrar sesión usa alcance local de Supabase y elimina la copia offline del usuario de ese navegador.

## 6. Preparar el proyecto Vercel existente

No crees otro proyecto. Enlaza con el que actualmente publica `monigones.vercel.app` y selecciona su equipo correcto:

```sh
npx vercel login
npx vercel link
```

Comprueba en el prompt el proyecto existente. No uses `--yes` para aceptar una creación accidental. `vercel.json` selecciona Vite, `npm run build:online`, salida `dist`, una Function en `api/[...path].ts`, región `dub1` y duración máxima de 60 segundos. No declara cron de Vercel ni requiere Cloudflare.

Introduce las variables con prompts interactivos:

```sh
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SECRET_KEY production
npx vercel env add MONIGONES_CRON_SECRET production
npx vercel env add PUBLIC_ORIGIN production
```

Repite para `preview` si usarás una preview. Para publicar previews de prueba utiliza un proyecto Supabase de pruebas y añade su URL al Auth; no mezcles deliberadamente datos de producción con una preview. `PUBLIC_ORIGIN` debe coincidir con la URL desde la que se prueba. Las variables nuevas requieren un nuevo build.

## 7. Construir y publicar

Solo tras autorizar los cambios remotos:

```sh
npx vercel pull --yes --environment=production
npx vercel build --prod
# Ejecuta el artefacto real en la misma versión principal de Node que Vercel.
# El proyecto actual usa nodejs24.x; con Node 24 instalado:
npm run test:vercel-artifact
# Si tu Node local sigue siendo 22, usa en su lugar:
# npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
npx vercel deploy --prebuilt --prod
```

La primera orden descarga configuración en `.vercel/`, ignorada por Git. La última publica y actualiza el dominio de producción. También puedes usar el despliegue por Git del proyecto existente, conservando el build command del repositorio.

Con Node 24 puedes ejecutar `npm run verify:vercel` para encadenar el build y la prueba antes de publicar. Esta prueba copia cada `.func` fuera del repositorio y carga su handler con Node nativo, sin `tsx`, sin dependencias del checkout y sin credenciales de producción. Ejecuta 13 comprobaciones HTTP con fixtures locales de Auth/PostgREST; no consulta Supabase remoto. Comprueba que la versión principal del proceso coincide con `runtime` en `.vc-config.json`. Si cambias la versión de Node en Vercel, utiliza esa misma versión al probar. Un build que termina correctamente no sustituye esta prueba de ejecución.

`build:online` también comprueba la cadena completa del backend mediante `tsconfig.online.json` (`NodeNext`). Mantén las extensiones `.js` en imports relativos del backend y del motor que utiliza: TypeScript resuelve los `.ts` originales, Vite conserva su funcionamiento y Node carga los `.js` que genera Vercel. No crees archivos manuales dentro de `.vercel/output`; el siguiente build los reemplaza. Detalles y evidencias: [corrección del runtime de Vercel](VERCEL_RUNTIME_FIX.md).

Verifica:

```sh
curl --fail https://monigones.vercel.app/api/health
```

Debe responder `mode: supabase-postgresql`, con demo y herramientas de reloj desactivadas. Esta comprobación consulta una RPC de la base; no devuelve éxito solo porque se haya servido el frontend. Si falta configuración, las migraciones o acceso a PostgreSQL, no continúes invitando usuarios.

## 8. Activar las tareas programadas en Supabase

Después de que la Function esté publicada, configura **Vault** en Supabase con estos dos nombres:

| Nombre en Vault         | Contenido                                      |
| ----------------------- | ---------------------------------------------- |
| `monigones_api_url`     | `https://monigones.vercel.app/api/cron`        |
| `monigones_cron_secret` | El mismo secreto independiente usado en Vercel |

Usa la interfaz de Vault; no pegues un secreto real en un archivo del repositorio. Después ejecuta el contenido completo de [supabase/setup-cron.sql](../supabase/setup-cron.sql) en el SQL Editor del proyecto correcto. Activa `pg_cron` y `pg_net`, crea la función privada de invocación y programa `monigones-tick` cada minuto. Repetirlo actualiza el mismo trabajo.

No se utiliza la clave privada de toda la base para el cron. La Function solo acepta el secreto específico, ignora tiempos del cuerpo y procesa el reloj de PostgreSQL. Si Vercel tiene protección de acceso que bloquee el endpoint de producción, debes permitir esa llamada de cron; no se ha configurado un bypass ni modificado tu cuenta.

Comprueba en SQL Editor:

```sql
select jobname, schedule, active from cron.job where jobname = 'monigones-tick';
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
select id, status_code, error_msg, created from net._http_response order by created desc limit 10;
select league_id, next_due_at, lease_until, attempts, last_error
from monigones_private.games order by next_due_at;
```

`cron.job_run_details` confirma el despacho; la respuesta HTTP y el checkpoint confirman el procesamiento real. Los errores permanecen en `last_error`. Cada lote reclama hasta diez ligas; las concesiones caducan en dos minutos. Un fallo antes del commit no aplica premios ni adjudicaciones parciales; el siguiente intento utiliza el checkpoint confirmado. Una respuesta perdida tras el commit no repite la operación.

Los procesos resuelven mercado, cierre diario, partidos, convocatorias, salarios, obras, investigaciones y subastas aunque nadie tenga abierto el juego. El final de una actividad produce su disponibilidad/aviso; **no recoge su recompensa automáticamente**. Al consultar o enviar un comando también se reconcilian vencimientos para no aceptar pujas fuera de plazo. La ejecución puede llegar después del minuto previsto, pero las reglas utilizan la fecha de vencimiento y las 06:00 de Madrid.

## 9. Comprobar Realtime y multijugador remotos

La migración publica exclusivamente `public.game_revisions`. No publiques `monigones_private.games`, recibos, RNG ni pujas secretas. RLS filtra las revisiones por membresía. El navegador recibe una invalidación y solicita a la Function su vista filtrada; las revisiones no transportan datos privados.

Con dos cuentas y dos perfiles de navegador:

1. Crea una liga y únete con la segunda cuenta **antes de presentar el primer jugador del draft**.
2. Envía chat y comprueba llegada sin recargar, identidad e historial.
3. Presenta un futbolista con el administrador y prueba pujas desde ambos usuarios.
4. Crea otra liga con una tercera cuenta y comprueba que no recibe chat, estado ni revisiones de la primera.
5. Inicia una obra/actividad, cierra ambos navegadores y comprueba avance en los logs del cron. Cobra una actividad una sola vez.
6. Revoca una sesión y confirma rechazo de operaciones con ese token. Verifica también expiración/renovación y recepción de correos reales si se usa SMTP.

Estos pasos de aceptación remota están **pendientes**, porque no se ha autorizado alterar los servicios. La publicación real de Realtime, GoTrue, PostgREST, correo y cron debe confirmarse allí; los fixtures locales no la sustituyen.

## 10. Publicar nuevos PNG en Vercel

Se mantienen los 522 archivos y sus nombres. En online el catálogo de contenido es `public/assets/futbol/manifest.json`, generado durante `build:online`; las imágenes siguen siendo archivos estáticos. No hay subida ni escritura permanente en Functions.

```sh
# Sustituye primero tus PNG con el mismo nombre en public/assets/futbol.
npm run images:validate
npm run images:manifest
npm run build:online
```

Revisa el resultado y publica la nueva versión mediante Git o el flujo Vercel anterior. El manifiesto cambia las versiones SHA-256 de las URLs y la PWA usa NetworkFirst para los PNG; una pantalla abierta vuelve a consultar el manifiesto aproximadamente cada minuto o al recuperar el foco. Si está sin conexión mantiene lo ya visitado hasta volver a conectarse. El service worker puede avisar de actualización del resto del código.

No edites archivos dentro de `.vercel/output` ni esperes que sustituir una copia en tu Mac actualice el dominio sin publicar. El cambio manual en caliente cada cinco segundos permanece en el modo local, con su servidor y carpeta local.

## 11. Instalar la PWA

**Android:** abre `https://monigones.vercel.app` en Chrome, inicia sesión y usa el menú → Instalar aplicación / Añadir a pantalla de inicio. Si no aparece, revisa que la página cargue por HTTPS y que el manifest y el service worker estén activos.

**iOS/iPadOS:** abre la misma URL en Safari → Compartir → Añadir a pantalla de inicio → Añadir. Abre después el icono instalado e inicia sesión allí; según el sistema, Safari y la app instalada pueden mantener sesiones separadas.

**Ordenador:** Chrome o Edge → icono de instalación o menú de instalar. El juego conserva su formato vertical. La PWA puede consultar su última copia sin conexión; jugar, pujar y cobrar requieren conectividad. La instalación física y el comportamiento del teclado en dispositivos reales siguen pendientes de verificación remota.

## 12. Planes gratuitos y costes potenciales

Verificado en documentación oficial durante la preparación (24/10/2026): Supabase Free incluye 500 MB de BD, 5 GB de egress, 50.000 usuarios activos mensuales, 2 millones de mensajes Realtime y 200 conexiones Realtime simultáneas. Puede pausar proyectos por una semana de inactividad; no proporciona disponibilidad continua garantizada. Monitoriza el tamaño de agregados, históricos y recibos. [Precios](https://supabase.com/pricing), [cuotas](https://supabase.com/docs/guides/platform/billing-on-supabase).

Vercel Hobby es para uso personal no comercial. Las Functions tienen cuotas de CPU, invocaciones y transferencia. El cron Hobby solo permite ejecución diaria y no sirve para los vencimientos del juego: por eso se usa Supabase Cron cada minuto. No se ha activado ningún plan de pago. Un proyecto con pagos o publicidad real puede necesitar otro plan por las condiciones de Vercel. [Hobby](https://vercel.com/docs/plans/hobby), [cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Las lecturas online usan ETag/304, fallback de sondeo cada 60 segundos y avisos de revisión pequeños para reducir transferencia. Las respuestas completas usan streaming y gzip opcional: una simulación de históricos de un año supera los 4,5 MB buffered permitidos por Vercel. [Límites de Functions](https://vercel.com/docs/functions/limitations). No se promete soportar usuarios ilimitados: el agregado incluye históricos completos, y los límites gratuitos deben observarse con uso real. La región única `dub1` aproxima la Function a Supabase Irlanda. No se utiliza un añadido IPv4 de pago ni un pool TCP permanente: el adaptador accede a RPC por HTTPS.

No se exige un servicio de pago como parte del código. SMTP, dominio propio, mayor disponibilidad, copias administradas y crecimiento pueden tener costes según la opción que elijas. Las claves, Vault, cuotas y la monitorización del proyecto real todavía requieren la configuración del propietario.
