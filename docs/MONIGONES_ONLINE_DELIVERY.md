# Monigones — Preparación Supabase + Vercel

Fecha: 24/10/2026. Base: Monigones v0.3. **Código online implementado y comprobado localmente; servicios remotos pendientes de configuración y aceptación.** No se ha modificado Supabase remoto, Vercel ni la partida SQLite. No se afirma que `monigones.vercel.app` ya ejecute esta versión.

## 1. Resumen de arquitectura

Frontend/PWA y recursos estáticos en Vercel; una Vercel Function por petición para ejecutar el motor TypeScript; Supabase Auth para identidad; PostgreSQL para persistencia autoritativa; Realtime para invalidaciones bajo RLS; Supabase Cron + Vault + pg_net para procesos sin navegador. El modo online no depende del Mac, un proceso Node permanente ni SQLite. Se conserva el arranque local anterior.

Se eligieron Functions Node de Vercel para reutilizar el motor íntegro y dar margen a la reconciliación de históricos; no se intenta alojar un servidor Node tradicional en Supabase. Las RPC privadas confirman cada decisión con bloqueo, revisión e idempotencia. [Diagrama y diseño](ONLINE_ARCHITECTURE.md).

## 2. Cambios realizados

- `server/online/store.ts`: adaptador PostgreSQL real con altas/uniones, lecturas, comandos, reintentos y worker.
- `server/online/transport.ts`: RPC sobre HTTPS, compatible con secret keys nuevas y service-role JWT antiguos.
- `server/online/handler.ts`: autenticación verificada, rutas y límites persistentes por cuenta.
- `api/[...path].ts`: entrada stateless para Vercel; sin SQLite ni escritura permanente.
- `server/online/response.ts`: respuesta JSON por streaming, compresión gzip opcional y backpressure.
- `src/lib/supabase.ts`, `src/lib/api.tsx`: SDK compartido, JWT renovable, Realtime, ETag/304 y cachés por proyecto/usuario; local conserva cookies y SSE.
- `scripts/build-online.mjs`: build separado, configuración online y rechazo de secretos en variables públicas.
- `scripts/football-manifest.ts`: catálogo estático de versiones para los 522 PNG.
- `vercel.json`, `.env.online.example`, `supabase/config.toml`, `supabase/setup-cron.sql`: configuración sin credenciales reales.
- Nuevo harness PostgreSQL desechable y pruebas de integración. Se actualiza Vitest a 5.0.5 para corregir vulnerabilidades de desarrollo detectadas; el audit posterior no encuentra vulnerabilidades.

No se han modificado `shared/engine.ts`, los datos deportivos, VM, puntuaciones, duraciones, recompensas, gráficos, CSS, Canvas ni atlas. No se ha cambiado el servidor SQLite ni migrado sus datos.

## 3. Migraciones PostgreSQL validadas

En un clúster **PostgreSQL 17.11 nativo y aislado**, con roles anon/authenticated/service_role y superficie Auth mínima para pruebas:

1. `202610230001_crown.sql`: esquema inicial histórico completo, 69 tablas, funciones, políticas, permisos y triggers. Su ejecución real no produjo errores de SQL; no se ha reescrito una migración histórica sin necesidad.
2. `202610240001_online.sql`: agregado JSONB privado, revisión, recibos, cuotas, membresía, once RPC privadas y publicación de revisiones.
3. `supabase/seed.sql`: ejecutado correctamente en la instancia desechable, incluidos 500 jugadores; no se necesita ni se aplica automáticamente en producción.

El adaptador activo guarda el estado completo de cada liga en `monigones_private.games`. Las tablas normalizadas históricas se conservan sin actuar como una segunda fuente de economía. La RPC de puja de ejemplo se retira del permiso authenticated. Esto evita una integración parcial en la que dos caminos diferentes aparenten modificar la misma partida.

`setup-cron.sql` está separado: requiere las extensiones alojadas y los secretos del propietario. Su activación real en Vault/pg_net/pg_cron **no se ha ejecutado**.

## 4. Funciones de backend migradas

[ONLINE_OPERATIONS.csv](ONLINE_OPERATIONS.csv) inventaría **42 comandos del motor** y las operaciones de Auth, incorporación y procesos. Todos los comandos jugables llegan al mismo motor y commit PostgreSQL: draft, subastas, pujas secretas, retiradas, venta, negociaciones/contraofertas/cesiones, contratos, cláusulas, blindajes, convocatoria, alineación, banquillo, cambios, recursos, edificios, instalaciones, investigaciones, actividades, recompensas, patrocinios, conciertos, instituciones, cantera, eventos, entrenadores, identidad, avisos, chat, moderación y temporadas.

Las herramientas `advance` e `importSports` siguen siendo del laboratorio local, conforme a su carácter de pruebas; producción no habilita el reloj administrativo ni cuentas demo seleccionables. Los permisos de administrador de las operaciones jugables se conservan en el motor.

Las confirmaciones son atómicas: una revisión caducada se descarta y se recalcula; estado, cambios de club/membresía, recibo y revisión pública se confirman juntos. El recibo resuelve respuestas perdidas y bloquea reutilización de clave con otro payload. No existe un paso separado que cobre y después intente asignar un propietario.

## 5. Configuración Realtime

La migración añade **solo `public.game_revisions`** a `supabase_realtime`. RLS limita lecturas a miembros. No se publican estados enteros, RNG, recibos, pujas privadas ni mensajes de otras ligas. El frontend escucha la revisión de su liga y vuelve a pedir su vista autorizada, agrupando avisos durante 200 ms. Se conserva un respaldo cada 60 segundos y al recuperar el foco. ETag/304 evita volver a transferir una partida sin cambios y actualiza el reloj.

Probado: publicación y RLS reales en PostgreSQL; protocolo cliente WebSocket emulado para probar el SDK, actualización de chat y aislamiento del frontend. **Pendiente:** transporte WAL/Realtime oficial alojado y sus cuotas reales.

## 6. Autenticación y permisos

El frontend usa `signUp`, `signInWithPassword`, persistencia y renovación del SDK. La API comprueba cada JWT mediante `Auth.getUser`, nunca acepta un usuario o rol suministrado por el comando, y busca la membresía en PostgreSQL. El cierre de sesión revoca la sesión actual y borra su copia offline. No se comparte el snapshot entre proyectos o usuarios.

Probado: roles efectivos, RLS, ejecución service-only, denegación de lecturas/escrituras directas, rechazo de privilegios falsos, rechazo de JWT sin firma válida en el fixture Auth y limpieza de caché al salir. El test utiliza el SDK real contra un emulador HTTP Auth con JWT firmados locales; **no prueba el correo ni GoTrue alojado**. Las claves de pruebas no son credenciales reales.

La clave privada y el secreto cron solo pertenecen a Vercel. No hay RPC cliente que acepte un JSON de saldo como escritura autorizada. Auth remoto, correo, confirmación de direcciones, expiración y renovación bajo la infraestructura real requieren aceptación posterior.

## 7. Procesos programados

Cron de Supabase invoca `/api/cron` cada minuto mediante pg_net y un secreto específico guardado en Vault. No se usa cron Hobby de Vercel, que es diario. El servidor ignora relojes aportados por el navegador. Cada liga dispone de próximo vencimiento, concesión con expiración, intentos y último error.

Los workers usan SKIP LOCKED y CAS; pueden coincidir con lecturas o comandos sin duplicar adjudicaciones, salarios, obras o recompensas. Un fallo antes de confirmar conserva el checkpoint anterior; un fallo tras confirmar se reconoce en la revisión/recibo. Concesiones abandonadas caducan en dos minutos. Se procesan hasta diez ligas por invocación y se limita el tiempo del lote.

Cubre mercado/06:00 Madrid, jornadas, convocatorias, salarios, subastas, obras, investigaciones, actividades y conciertos. Completar el contador de actividad no recoge la recompensa; la regla manual de v0.3 permanece. Un día de actividad pendiente conserva su contabilidad original.

## 8. Pruebas ejecutadas realmente

Antes de los cambios: **95 unitarias y 32 de navegador aprobadas**, una captura histórica omitida intencionalmente.

Después:

| Verificación                                                            | Resultado                                     |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| Unitarias/regresión de dominio y SQLite                                 | 95 aprobadas                                  |
| Navegador del modo local, incluyendo WebKit y Android emulado           | 32 aprobadas; 1 captura histórica omitida     |
| Integración PostgreSQL, transacciones, permisos, HTTP y frontend online | 20 aprobadas                                  |
| TypeScript y ESLint                                                     | Aprobados                                     |
| Build local y build online separado                                     | Aprobados                                     |
| PNG                                                                     | 522 conservados; manifiesto con 522 versiones |
| Audit de dependencias                                                   | Sin vulnerabilidades tras actualizar Vitest   |
| Build con clave privada en VITE pública                                 | Rechazado antes de compilar, como se esperaba |

Los casos PostgreSQL incluyen también la ejecución real de la RPC histórica bajo su propietario de confianza y el rechazo de referencias cruzadas mediante triggers. Cubren: dos usuarios de la misma liga y uno de otra; pujas simultáneas sin exceder reservas; doce reintentos de inicio; cobros concurrentes; draft y propietario único; rollback; incorporación concurrente; leases expiradas; recuperación de fallos; jornada/salarios sin duplicar; respuestas condicionales; transporte HTTP; tres navegadores con chat y PWA offline; rechazo de rutas Node/SSE en online; salida y borrado de copia offline; y respuesta streaming mayor que 4,5 MB.

El harness aplica **todos** los archivos de migración en cada ejecución y destruye su clúster. No usa la partida local ni una base de producción. Evidencia en `docs/validation/online/`: logs, DDL ejecutado, informe del navegador, captura y medición de históricos. La simulación en memoria a 365 días produce unos 10 MB de JSON público; se implementó streaming y compresión para evitar el límite de respuesta buffered de Vercel sin descartar históricos. Esto no elimina límites de duración, transferencia, almacenamiento o memoria.

No se ha ejecutado un stack Docker Supabase completo: no hay Docker instalado. El fixture HTTP de RPC delega en PostgreSQL real con su rol; Auth y Realtime emulan sus contratos. No se presenta esta prueba como aceptación de servicios alojados.

## 9. Variables necesarias

Públicas de build: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Privadas de Function: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `MONIGONES_CRON_SECRET`. Origen permitido: `PUBLIC_ORIGIN=https://monigones.vercel.app`. `build:online` fija `VITE_BACKEND=supabase`; local permanece separado.

Las variantes legacy anon/service-role están soportadas. La plantilla no contiene valores reales. No se guarda una contraseña PostgreSQL ni una clave privada en el frontend.

## 10. Conectar el proyecto Supabase

[Guía exacta de conexión](ONLINE_SETUP.md#4-aplicar-las-migraciones-al-proyecto-correcto): obtener project ref en Dashboard, login interactivo, link al proyecto existente, revisar historial, dry-run y aplicar las migraciones solo tras autorización. Configurar Auth, redirect del dominio y correo. No se necesita un servicio PostgreSQL permanentemente accesible desde el Mac.

El nombre de proyecto y la región aportados por el usuario no equivalen al project ref ni proporcionan las claves. No se han adivinado ni buscado credenciales en otros proyectos.

## 11. Desplegar en Vercel

[Variables y despliegue](ONLINE_SETUP.md#6-preparar-el-proyecto-vercel-existente): enlazar con el proyecto existente, introducir variables por prompts, construir y desplegar a `monigones.vercel.app`. No crear un proyecto alternativo. Después configurar Vault y activar `setup-cron.sql`. No se ha ejecutado ninguno de esos cambios.

El build online publica frontend, PWA, Canvas y los 522 PNG con manifiesto estático. Añadir una imagen implica sustituirla en el repositorio y publicar otra versión. La Function no guarda archivos de usuario ni necesita disco permanente. [Instrucciones PNG](ONLINE_SETUP.md#10-publicar-nuevos-png-en-vercel).

## 12. Instalar la PWA

[Instrucciones Android, iOS y ordenador](ONLINE_SETUP.md#11-instalar-la-pwa): Chrome → Instalar aplicación en Android; Safari → Compartir → Añadir a pantalla de inicio en iOS; icono de instalación en Chrome/Edge de escritorio. HTTPS obligatorio salvo localhost. La última copia sirve para consultar offline; transacciones y sincronización requieren conexión. La prueba automatizada comprueba recarga offline del build online, no una instalación física real.

## 13. Limitaciones y costes potenciales

Código completado: adaptador, seguridad de la API/RPC, cliente Auth/Realtime, worker, manifiesto PNG, configuración Vercel y pruebas. Código probado localmente: PostgreSQL 17 real, roles/RLS/funciones, dominio, SQLite, navegadores, build online y PWA; protocolos Auth/Realtime con fixtures.

Pendiente de validación remota: configuración efectiva del proyecto Supabase y Vercel, publicación WAL/Realtime, GoTrue y correo reales, Vault/pg_net/cron, política de protección del endpoint de cron, runtime/streaming y cuotas en Vercel, instalación y teclado en dispositivos físicos. Los recursos no se han publicado. Estas comprobaciones requieren la autorización que el usuario ha reservado.

No se requiere un plan de pago por diseño. Vercel Hobby es de uso personal no comercial y su cron es insuficiente para el juego; Supabase Free tiene cuotas de almacenamiento, transferencia y Realtime y puede pausar proyectos. El correo público con confirmación necesita una configuración SMTP adecuada; una prueba privada puede desactivar confirmación, aceptando emails no verificados. Históricos JSONB completos y recibos crecen con el uso; deben monitorizarse. [Cuotas y fuentes oficiales](ONLINE_SETUP.md#12-planes-gratuitos-y-costes-potenciales).

No se promete disponibilidad ilimitada en planes gratuitos. No se han contratado servicios, activado añadidos de pago ni modificado remotamente datos o configuración.

## 14. Decisiones autónomas

1. **Vercel existente** para frontend y API; se descarta Cloudflare del camino de producción solicitado.
2. **Function stateless Node** para reutilizar las reglas completas; no levantar un servidor tradicional ni portar parcialmente la economía.
3. **Agregado JSONB privado por liga** como fuente única de estado; conservar el esquema histórico sin duplicar saldos y propietarios en dos modelos activos.
4. **CAS, bloqueo ordenado y recibo en una transacción** para conservar invariantes ante concurrencia, reintentos y respuestas perdidas.
5. **Privilegios service-only y vistas filtradas**; Auth decide identidad, el motor permisos y PostgreSQL confirma cada escritura.
6. **Revisiones pequeñas con RLS** para Realtime; no transportar por el canal los datos privados del agregado.
7. **ETag/304, coalescencia y sondeo de respaldo** para reducir consumo del plan gratuito sin depender exclusivamente del WebSocket.
8. **Supabase Cron + Vault + pg_net** en lugar de cron diario Hobby; secreto de alcance limitado, concesiones con expiración y recuperación desde checkpoint.
9. **Streaming y gzip** tras medir históricos de un año; preservar datos sin depender del límite buffered de 4,5 MB.
10. **Manifiesto PNG durante build** para conservar la sencillez de nombres y publicar los 522 recursos sin escribir en el filesystem efímero de Vercel.
11. **Configuración local/online y cachés separadas** para conservar la partida SQLite y evitar mezcla de usuarios o proyectos.
12. **Native PostgreSQL desechable + fixtures explícitos de servicios** por ausencia de Docker; distinguirlos de Supabase oficial alojado y dejar pendiente su aceptación real.
13. **Actualizar el ejecutor de pruebas vulnerable** sin cambiar dependencias de reglas o apariencia; repetir pruebas y audit.
14. **Detenerse en preparación local**: no enlazar cuentas, aplicar migraciones remotas, activar cron ni desplegar sin la autorización reservada.
