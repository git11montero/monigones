# Demostración online de Monigones

El importador reutiliza el motor del juego local. No lee tu partida personal por defecto, no copia contraseñas o sesiones y no crea cuentas Auth. La preparación y las pruebas se realizan localmente; los comandos de producción de este documento son pasos posteriores para el propietario.

## Archivos

- `server/demo/state.ts`: fuente reproducible, instantáneas, validación de catálogo/referencias y adaptación de identidades y fechas.
- `server/demo/service.ts`: previsualización, comprobación de usuarios, creación, asociación posterior y verificación de lectura.
- `scripts/seed-online-demo.ts`: CLI controlado, validación del proyecto, consulta oficial a Auth y confirmación interactiva.
- `scripts/export-local-demo.ts`: exportación generada o lectura explícita y de solo lectura de una copia SQLite.
- `supabase/migrations/202610250001_online_demo.sql`: tres tablas privadas de control y tres RPC restringidas al rol de servidor.
- `tests/online-demo.test.ts` y `tests/online/demo.integration.ts`: pruebas de la fuente, seguridad, PostgreSQL y API.
- `docs/examples/online-demo.config.example.json`: configuración de ejemplo sin credenciales.

`package.json` registra `seed:online-demo` y `export:local-demo`. `server/online/store.ts` conserva el nombre de presidente de la demo guardado en cada club; las ligas normales siguen usando sus perfiles. `.monigones-demo/` está ignorada por Git. No hay cambios de frontend, catálogo, gráficos ni reglas económicas/deportivas.

## Procedencia de los datos

SQLite se inicializa en `server/store.ts`, constructor de `Store`: crea `demo1` a `demo6`, llamados **Presidente 1** a **Presidente 6**, y guarda `createGame(Date.now())`. Sus correos locales `crown.local` y contraseñas desactivadas no se importan. `Store.save()` llama a `syncAttention()`.

| Datos                                                                          | Fuente compartida                                    | Comportamiento                                                                                                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Liga, seis clubes, colores y equipos favoritos                                 | `shared/seed.ts`, `createGame()`                     | Real Corona, Atlético del Barrio, Deportivo Aurora, Sporting Oliva, Unión del Puerto y Racing Imperial; mismo nombre de liga local                                                       |
| Recursos, edificios, instalaciones, investigaciones, entrenador y convocatoria | `makeClub()`, `emptySelection()`, `shared/config.ts` | Presupuesto inicial de 100 M€, 100 PD, 0 medallas/fama/suerte, prestigio 25 y 60 aficionados; edificios iniciales a nivel 1; instalaciones e investigaciones vacías; entrenador genérico |
| Equipos reales, futbolistas y posiciones                                       | `shared/sports.ts`, `REAL_CLUBS`, `roster()`         | 20 clubes reales y exactamente 500 futbolistas, incluyendo los simulados que ya contiene el catálogo; no se añaden jugadores                                                             |
| Valores e historial de mercado                                                 | `roster()`, `shared/math.ts`, motor diario           | Valores iniciales deterministas; en una instantánea se conservan los valores ya evolucionados                                                                                            |
| Entrenadores                                                                   | `COACHES`                                            | Los cuatro del catálogo actual; no se crean nuevos                                                                                                                                       |
| Plantillas, contratos, prima demo y movimientos                                | Rama demo de `createGame()`                          | 12 futbolistas por club, 72 contratos, 72 asignaciones y 78 asientos de dinero; presupuesto menos asignaciones más prima demo de 20 M€                                                   |
| Draft, mercado y reglas económicas                                             | `createGame()`, `shared/engine.ts`, `RULES`          | Inicial con draft pendiente; avanzada generada con draft terminado; mercado inicial de cinco futbolistas                                                                                 |
| Jornadas, calendario y clasificaciones                                         | `makeRound()`, `mockMatches()`, `mockScore()`, motor | Una jornada inicial con diez partidos, puntos iniciales a cero; las instantáneas conservan jornadas e informes existentes                                                                |
| Eventos y temporada                                                            | `makeEvents()`, `createGame()`                       | Seis eventos iniciales y temporada de 266 días; mismos premios y objetivos                                                                                                               |
| Noticias y chat                                                                | `createGame()`                                       | Una noticia; avanzada generada con los dos mensajes locales originales; inicial sin chat                                                                                                 |
| Actividades y avisos                                                           | `shared/activities.ts`, `syncAttention()`            | Se usa el mismo catálogo y generador; no se conceden premios durante la importación                                                                                                      |
| Obras, instalaciones, investigaciones, medallas, fama y prestigio acumulados   | Instantánea validada de una demo SQLite              | Se conserva el progreso existente; no se inventan niveles o recompensas                                                                                                                  |
| Patrocinios, conciertos, negociaciones, préstamos y archivos                   | `GameState` y motor                                  | Vacíos en la demo recién generada; se conservan si existen en una instantánea válida                                                                                                     |

`supabase/seed.sql` alimenta el esquema normalizado histórico y sus catálogos para pruebas. **No es el guardado que consume la API online.** Este importador no duplica la partida en las 69 tablas históricas ni modifica sus filas existentes: crea `public.leagues`, `public.memberships`, `monigones_private.games.state` y `public.game_revisions`, las estructuras que usa `PostgresStore` en producción.

## Modalidades

**Inicial (`mode: "initial"`)**: utiliza `createGame(..., false)` y `makeClub()` con los seis clubes de la demo. No tiene contratos ni asignaciones ni prima final del draft; todos conservan los recursos iniciales y el draft está pendiente.

**Avanzada generada (`mode: "advanced"`, sin `snapshot`)**: reproduce exactamente la demo recién inicializada en SQLite con `createGame(..., true)` y `syncAttention()`. Tiene plantillas, contratos, libro económico, noticia y chat; no finge edificios avanzados ni investigaciones, conciertos o resultados que el generador local no crea.

**Avanzada desde instantánea**: reproduce un checkpoint concreto de la demo local mutable, con su progreso real, valores, recursos, plantillas, investigaciones, trabajos, rondas, informes y demás datos. Solo admite los seis presidentes `demo1`…`demo6`, con `demo1` como administrador, y el catálogo actual de 500 jugadores. Una partida personal, un catálogo personalizado o un checkpoint con trabajos/cierres vencidos se rechazan.

La demo avanzada ocupa las 12 plazas iniciales de cada club. Para pujar por otro jugador debes vender uno o ampliar la capacidad con las reglas existentes.

## Tiempo y reproducibilidad

`sourceAt` fija la fecha del generador y `seed` estabiliza los UUID incidentales. Los nombres, posiciones y valores iniciales salen del motor; el reloj afecta al calendario y a los historiales. No se sustituye el generador de economía o deporte.

Con `startAt: "now"`, la hora de PostgreSQL determina el nuevo checkpoint. Se conservan las duraciones pendientes y la edad de la temporada, desplazando timestamps, fechas de actividad/patrocinio y referencias. El mercado se programa con `nextMarket()` a las **06:00 Europe/Madrid**, incluyendo los cambios de horario. `timeOffset` se pone a cero. No se reconcilian meses de historia ni se liquidan tareas antiguas durante la carga.

Se admiten fechas ISO explícitas en `startAt` para ensayos reproducibles; al aplicar deben estar a menos de cuatro minutos del reloj de PostgreSQL y la primera tarea debe seguir siendo futura. SQL vuelve a comprobar la frescura antes del commit. Para producción conviene `"now"`. El plan se recalcula después de confirmar y los reintentos reutilizan la fecha guardada en el registro original.

Cambian deliberadamente las identidades necesarias para otra liga: UUID de liga/clubes y referencias internas, usuarios Auth y ancla temporal. PostgreSQL genera una invitación y un secreto económico nuevos e impredecibles; no se derivan de la semilla pública ni se imprimen. Las propuestas diarias dependen de la liga y de la fecha con el motor actual, por lo que pueden diferir al trasladar la partida. Los textos y metadatos de procedencia de los futbolistas se conservan.

## Preparación privada

Node 22.22+ y dependencias instaladas con `npm ci`. Crea una carpeta privada:

```sh
umask 077
mkdir -p .monigones-demo
cp docs/examples/online-demo.config.example.json .monigones-demo/config.json
node -e 'console.log(crypto.randomUUID())'
```

Edita `.monigones-demo/config.json`: sustituye `projectRef`, `leagueId` por un UUID nuevo y `adminUserId` por el UUID real de tu cuenta Auth. Pon ese mismo usuario en `users.demo1`. Los valores de ejemplo son marcadores, no cuentas utilizables. Conserva la configuración para los reintentos. Usa otra liga/archivo para una demo diferente.

`environment` admite `local`, `staging` o `production`. En remoto la URL debe coincidir exactamente con `https://PROJECT_REF.supabase.co`; el comando comprueba proyecto y entorno. Los dominios personalizados de Supabase no están habilitados para este importador. El modo local solo admite loopback y `projectRef: "local"`.

Crea mediante tu editor `.monigones-demo/credentials.env` con permisos privados:

```dotenv
MONIGONES_DEMO_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
MONIGONES_DEMO_SECRET_KEY=TU_CLAVE_PRIVADA_DE_SERVIDOR
```

```sh
chmod 600 .monigones-demo/credentials.env
```

La clave es `sb_secret_…` o el JWT `service_role` antiguo, nunca la publishable/anon. Solo se usa desde Node en tu ordenador: no se añade a Vercel ni al navegador. No la pegues en comandos con historial, capturas ni archivos versionados. `--env-file` es explícito; el script no carga por defecto las credenciales de desarrollo o producción de otras herramientas. Las variables ya exportadas en el shell tienen prioridad sobre el archivo: revisa que pertenezcan al entorno elegido.

## Usuarios reales

Registra las cuentas con el formulario online de Supabase Auth o mediante sus procedimientos oficiales de invitación; no insertes filas en `auth.users`. Completa la confirmación de correo cuando esté activada. Obtén los UUID desde Authentication → Users y añade, por ejemplo, `users.demo2` hasta `users.demo6` en la configuración.

El CLI consulta `auth.admin.getUserById()` y rechaza cuentas inexistentes, eliminadas o suspendidas. PostgreSQL comprueba de nuevo su existencia y que no pertenezcan a otra liga. No se copian contraseñas, correos locales ni sesiones; no se modifica el nombre de un perfil ya existente.

Puedes empezar solo con `demo1`. Los otros cinco clubes tendrán identificadores internos reservados, sin usuarios Auth, sesiones ni membresías accesibles desde Internet. Conservan sus nombres de presidente. Para jugar con los seis, asocia después las cuentas reales mediante el procedimiento de asociación; la invitación normal del juego crea un club nuevo y no reclama uno reservado.

## Migración adicional: paso posterior autorizado por el propietario

Necesitas las dos migraciones previas y `202610250001_online_demo.sql`. La nueva migración añade `demo_seeds`, `demo_slots` y `demo_runs` dentro del esquema privado; no elimina ni recrea tablas existentes. Sus tres RPC `online_demo_inspect`, `online_demo_apply` y `online_demo_bind` solo permiten ejecución con `service_role`; RLS permanece activa y el navegador no obtiene nuevos permisos.

No se ha aplicado al Supabase remoto durante el desarrollo. Cuando decidas autorizar esa modificación, revisa el proyecto y el plan:

```sh
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase migration list
npx supabase db push --dry-run
```

Si las dos migraciones anteriores ya están registradas, el único cambio nuevo esperado es `202610250001_online_demo.sql`. Si aparecen otras diferencias, revísalas antes de continuar. Para aplicar el plan revisado, **solo cuando lo autorices**:

```sh
npx supabase db push
```

No ejecutes `db reset`, no repares el historial para ocultar diferencias ni vuelvas a cargar `supabase/seed.sql` en producción para crear la demo. El script de importación requiere la nueva migración; no intenta instalarla automáticamente.

## Previsualizar, aplicar y verificar

Sin argumentos solo se muestra ayuda. La previsualización consulta Auth y RPC de lectura; no crea perfiles ni modifica la partida:

```sh
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --dry-run
```

Revisa entorno, proyecto, UUID de liga, cuentas asociadas, recursos, cantidades y primera tarea. Los conflictos se muestran y devuelven código distinto de cero. Para cargarla:

```sh
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --apply
```

Debes usar una terminal interactiva y escribir exactamente `CARGAR PROJECT_REF UUID_LIGA`. No existe `--yes`, confirmación automática ni ejecución por defecto. La RPC vuelve a validar identidades, destino y reloj en la transacción.

```sh
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --status
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --verify
```

`--status` muestra registro, asociaciones, revisión y si el estado cambió. `--verify` comprueba identidad, revisiones, membresías, cantidades y la vista filtrada que usa la API, sin avanzar el reloj ni escribir. Si ya hubo juego o cron, `modifiedSinceSeed: true` es normal: la verificación de lectura sigue disponible y la reposición queda bloqueada. Después entra en `https://monigones.vercel.app` con las cuentas asociadas; la sesión detectará su membresía existente. Si ya tenían la aplicación abierta, recárgala o vuelve a iniciar sesión para consultar la nueva membresía.

## Incorporar presidentes más tarde

Añade los nuevos UUID a `users` sin quitar ni sustituir los ya asociados, manteniendo el resto de la configuración y la fuente:

```sh
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --bind-users --dry-run
npm run seed:online-demo -- --config .monigones-demo/config.json --env-file .monigones-demo/credentials.env --bind-users --apply
```

La confirmación será `ASOCIAR PROJECT_REF UUID_LIGA`. Solo ocupa clubes reservados; conserva contratos, recursos y progreso, incluso si ya se ha jugado. No transfiere clubes con dueño, cambia administrador ni elimina membresías. Un reintento con las mismas asociaciones devuelve `already_bound`.

## Exportar una demo avanzada

Para generar la misma demo local nueva sin abrir ninguna SQLite:

```sh
npm run export:local-demo -- --generated --at 2026-10-23T12:00:00+02:00 --seed monigones-demo-v1 --out .monigones-demo/advanced.snapshot.json
```

Para conservar progreso de una demo mutable, utiliza exclusivamente una copia que hayas autorizado, coherente y actualizada. Si la haces manualmente, cierra antes el servidor local y conserva correctamente el WAL; no copies solo el archivo principal de una base activa. El comando no busca ni abre por defecto `data/crown.sqlite`:

```sh
npm run export:local-demo -- --sqlite /ruta/a/copia-autorizada.sqlite --league UUID_LIGA_LOCAL --confirm-demo-read --out .monigones-demo/advanced.snapshot.json
```

Se abre con `DatabaseSync(..., { readOnly: true })`, en una transacción de lectura, sin inicializar `Store`, alterar tablas ni leer contraseñas/sesiones. La exportación valida el checkpoint; si hay vencimientos pendientes a su propio reloj, actualiza la demo local autorizada antes de volver a exportar. No se repara silenciosamente.

En la configuración usa `mode: "advanced"` y añade `"snapshot": "advanced.snapshot.json"`. La ruta se resuelve respecto al archivo de configuración. `sourceAt` deja de determinar los datos: la fuente será la instantánea. Su SHA-256 detecta modificaciones; no sustituye confiar en el origen. El archivo contiene datos privados de juego y se crea con permiso `0600`, sin sobrescribir otro export anterior. No lo pongas en `public/` ni lo publiques.

## Atomicidad, reintentos y recuperación

La creación persiste liga, perfiles nuevos, miembros reales, slots, agregado privado, revisión y registro de ejecución en una sola transacción. Si falla cualquier paso, todo se revierte. Los bloqueos de perfil, destino y revisión evitan duplicados y asociaciones concurrentes incompatibles. Una pérdida de respuesta después del commit se resuelve consultando `--status` y repitiendo la misma configuración/fuente.

Una demo intacta devuelve `already_initialized`. Si cambió por jugadores o cron, devuelve `DEMO_MODIFIED` y conserva la partida. Un destino ocupado sin registro demo devuelve `DEMO_TARGET_OCCUPIED`. Configuración distinta, usuario de otra liga, cuenta inexistente o slot con dueño se rechazan. Un fallo de creación deja el destino vacío; un fallo de asociación conserva todos los vínculos previos. Las ejecuciones confirmadas quedan en `monigones_private.demo_runs`, sin claves ni estados completos en el registro.

No hay operación de reinicio o reemplazo. Para otra demo usa un UUID de liga nuevo y cuentas sin membresía incompatible. Reutilizar cuentas ya vinculadas o retirar una demo requiere un procedimiento separado, revisión de datos y autorización explícita; no se ofrece un borrado encubierto en este script.

## Realtime y procesos automáticos

La creación y las asociaciones publican `game_revisions` dentro de su commit. Se conserva la publicación `supabase_realtime` y su política de lectura por miembros: no se publican estados privados, saldos, pujas ni registros de importación. La API existente y su sincronización funcionan con la membresía recién creada.

`games.next_due_at` se calcula con `nextWake()` del adaptador actual. El cron ya instalado puede reclamar la liga y resolver mercado, obras, investigaciones, actividades y jornadas mediante el motor. El importador no activa ni modifica cron ni ejecuta liquidaciones de historial. Las recompensas manuales continúan siendo manuales. El funcionamiento de los servicios Realtime/Auth/Cron oficiales en tu proyecto debe comprobarse después de la autorización y carga remotas.

## Validación local

```sh
npm run check
npm run lint
npm test
# PostgreSQL 17+, exclusivamente clúster nuevo y desechable:
MONIGONES_PG_BIN="$(brew --prefix postgresql@17)/bin" npm run test:postgres
npm run build
# Con URL/clave pública del entorno de build configuradas:
npm run build:online
```

El script PostgreSQL crea un directorio y puerto temporales, aplica las migraciones y seed únicamente allí, ejecuta las pruebas y destruye su propio clúster. Las cuentas `auth.users` de esas pruebas son fixtures del clúster desechable; el CLI real consulta el SDK oficial de Auth por HTTP y nunca inserta usuarios.

La integración incluye ambas modalidades, catálogo, recursos/plantillas, presidentes y membresías, API y operaciones económicas, avances/cron, conservación de progreso, aislamiento/RLS, WAL de la tabla publicada para Realtime, reintentos, concurrencia, duplicados, rollback al fallar el último paso, asociación parcial fallida y rechazo de llamadas no autorizadas. Los servicios HTTP de Auth se prueban con fixtures locales y SDK oficial; no se presenta esa prueba como una ejecución del stack completo Supabase ni como validación remota.

Resultados de esta entrega: [ONLINE_DEMO_DELIVERY.md](ONLINE_DEMO_DELIVERY.md).
