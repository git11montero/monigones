# Sustitución controlada de la demo

Procedimiento preparado para **SQLite local** y el agregado **JSONB privado de Supabase**. Durante el desarrollo no se ha abierto ni sustituido la partida del usuario, consultado su configuración privada, ejecutado operaciones en Supabase remoto, modificado Auth ni desplegado en Vercel. Los respaldos y sustituciones de prueba utilizan bases nuevas y desechables.

## Fuente definitiva

`data/demo-fantasy-v06.json` es la fuente de las demos nuevas, la previsualización y el reemplazo. Cinco equipos: Cholo ATM, Porcinos FC, Madurito, Juancarli Team y Joselinho. Sexto club: Plaza reservada, vacío y sin cuenta ni sesión. Hay 500 futbolistas, 55 titulares, tres suplentes y **58 contratos**, sin propietarios duplicados.

Identificaciones definitivas proporcionadas por el usuario y contrastadas con el catálogo existente:

| Jugador | Registro | Posición | Club real | Equipo Fantasy |
|---|---|---|---|---|
| Antony Matheus dos Santos, nombre deportivo Antony | `betis-17` | DEL | Real Betis | Porcinos FC |
| Fermín López | `barcelona-14` | MED | FC Barcelona | Cholo ATM |

No se han creado futbolistas ni importado puntuaciones, precios o resultados externos. Se mantienen las formaciones 3-3-4, 4-2-4, 3-4-3, 3-4-3 y 3-3-4. Sede/estadio nivel 4, césped necesario para cada dibujo, vestuario suficiente y banquillo nivel 4 para los tres suplentes de Cholo. Calidades iniciales Básico, salarios normales y dotación explícita de 100 M€ por club. Son parámetros del escenario; las reglas del motor y las ligas normales no cambian.

```sh
npm run seed:online-demo -- --config examples/demo-fantasy-v06.config.json --offline-preview
```

Este comando no necesita credenciales ni red. Comprueba identidades, posiciones, capacidad, alineaciones, suplentes y contratos. Las demos avanzadas nuevas utilizan esta misma fuente. La modalidad inicial conserva el draft pendiente y los recursos iniciales habituales, con estos mismos nombres. `npm run dev` **no sustituye** una demo SQLite existente. El sexto club nuevo no genera usuario local `demo6`; si existe uno histórico se conserva como registro sin crearle una sesión nueva.

## Vista previa y confirmación

`--dry-run` y `--verify` no escriben. La vista previa muestra destino, administrador, clubes, recursos, contratos, draft, trabajos/subastas/actividades pendientes, categorías que se perderán, elementos conservados y UUID previsto para el respaldo. En producción incluye otras membresías y si cambió la revisión desde la importación. No imprime el agregado, claves, contraseñas, RNG privado ni pujas.

La sustitución descarta el progreso de **esa liga**: fichajes, construcciones, investigaciones, recursos, resultados y jornadas, noticias, chat, contratos, actividades, recompensas, eventos y recibos anteriores. El detalle real de la partida se conocerá al ejecutar su vista previa autorizada; las pruebas sintéticas no permiten afirmar cuánto progreso tiene la partida real.

`--apply` necesita una terminal interactiva y esta frase exacta, que el programa muestra:

```text
SUSTITUIR <entorno> <projectRef> <UUID_liga> <UUID_respaldo>
```

No existe `--force` ni confirmación por tubería. El respaldo se crea después de confirmar y antes del cambio de estado. Si la partida cambia mientras se confirma, se rechaza con `REPLACE_STALE_PREVIEW`: volver a previsualizar y confirmar. La ventana de validez del plan online es de dos minutos.

`--operation UUID` permite fijar el identificador del respaldo para reintentar una operación ya confirmada sin aplicarla otra vez. Una operación reutilizada con otro destino, fuente o restauración se rechaza. No reintentar un fallo de exportación con un UUID nuevo: el reemplazo puede haber terminado correctamente en PostgreSQL.

## SQLite: ejecutar posteriormente

Desde la raíz del repositorio, con la partida predeterminada `data/crown.sqlite`:

```sh
npm run demo:replace -- --target local --dry-run
npm run demo:replace -- --target local --apply
npm run demo:replace -- --target local --verify
npm run dev
```

Si se usa otra ruta, añadir `--sqlite /ruta/partida.sqlite` a **todos** los comandos, o definir `CROWN_DB` igual que al arrancar el servidor. Si hay más de una demo administrativa, especificar `--league UUID`. No se crea una base inexistente ni se inicializa `Store` para inspeccionarla. Los usuarios asociados deben ser exclusivamente usuarios de demostración deshabilitados; se rechaza una liga con cuentas reales.

La copia utiliza la API de respaldo SQLite, incluyendo el contenido confirmado en WAL, con un bloqueo `BEGIN IMMEDIATE` que impide escritores concurrentes. Comprueba `integrity_check`, referencias y huella antes de sustituir. Incluye **todas las tablas** del archivo original, incluso tablas ajenas al juego. La transacción sustituye exclusivamente la liga, sus membresías demo, recibos y registros de sincronización. Conserva usuarios, contraseñas, sesiones y otras ligas. El sexto club nuevo queda reservado; no se borra su antiguo usuario si existía.

Los archivos privados quedan en `.monigones-demo/backups/`: `<UUID>.sqlite`, manifiesto `<UUID>.json` con SHA-256, versión, fecha y huella, y un informe `<UUID>.<intento>.report.json`. Permisos de archivos 0600 y carpeta nueva 0700. Si el cambio falla, la transacción revierte y el respaldo ya completado sigue disponible para reintentar. Se rechazan destinos dentro del código o los recursos publicados; se admite una carpeta externa privada mediante `--backup-dir`.

Detener el servidor local antes de iniciar la confirmación: su trabajador escribe cada cinco segundos y puede invalidar la vista previa mientras se escribe la frase. Si sigue abierto, las escrituras se serializan; las acciones del cliente antiguo se rechazan hasta recargar y SSE comunica la revisión siguiente.

Restaurar (sustituir `UUID_RESPALDO` por el UUID real):

```sh
npm run demo:replace -- --target local --restore UUID_RESPALDO --dry-run
npm run demo:replace -- --target local --restore UUID_RESPALDO --apply
npm run demo:replace -- --target local --verify
```

La restauración verifica el archivo y su manifiesto, muestra la comparación y crea **otro respaldo del estado actual** antes de restaurar. Recupera las filas de la liga, conservando las otras ligas del archivo actual. La copia completa queda disponible para recuperación manual del archivo entero con el servidor parado; la herramienta no sobrescribe todo el archivo de SQLite.

## PostgreSQL: preparación y ejecución posterior

El destino de producción está fijado en `examples/demo-replacement.production.json`:

- Proyecto `vevmceaoebrpctepytzn`.
- Liga `d42761a6-e7a1-4e99-a1e1-5d3424a244b9`.
- Administrador Auth `9172013f-73b5-4edb-8441-436602e82236`.

La CLI rechaza otro proyecto, liga o administrador. Requiere `mode=advanced`, `startAt=now` y solo la vinculación `demo1` con el administrador existente. Los otros cinco clubes son reservas, sin crear cuentas Auth. No se actualiza el perfil ni el correo/contraseña; se conserva el UUID de liga y su administrador, y se cambia coherentemente su `membership.club_id` al Cholo ATM nuevo.

**Antes de sustituir, instalar la migración y publicar el backend/frontend nuevos.** El encabezado de generación `X-Monigones-Generation` protege contra comandos de pestañas antiguas después de una sustitución. Debe desplegarse antes de usar la herramienta. No usar la operación con el backend anterior.

Los siguientes comandos modifican servicios remotos y quedan para **autorización y ejecución posterior**, no se han ejecutado durante el desarrollo:

```sh
# Revisar las migraciones pendientes antes de autorizar la aplicación.
npx supabase link --project-ref vevmceaoebrpctepytzn
npx supabase db push --linked --dry-run
# Aplicar solo si la lista pendiente es la prevista y se autoriza:
npx supabase db push --linked

# Construir localmente el artefacto enlazado de Vercel y ejecutarlo con Node 24.
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
# Solo después de autorizar la publicación:
npx vercel deploy --prebuilt --prod
```

La nueva migración `202610250002_demo_replace.sql` instala tablas de respaldo/auditoría y RPC de mantenimiento; **instalarla no sustituye ninguna liga ni modifica Auth o Cron**. No ejecutar `db reset` ni reimportar la demo para reemplazarla.

Preparar la configuración privada (sin sobrescribir configuraciones privadas existentes):

```sh
mkdir -p .monigones-demo
cp -n examples/demo-replacement.production.json .monigones-demo/replacement.production.json
chmod 700 .monigones-demo
chmod 600 .monigones-demo/replacement.production.json .monigones-demo/credentials.env
```

El archivo existente `credentials.env` debe definir `MONIGONES_DEMO_SUPABASE_URL=https://vevmceaoebrpctepytzn.supabase.co` y `MONIGONES_DEMO_SECRET_KEY` con la clave secreta de servidor correspondiente. No usar `VITE_`, argumentos de shell con claves ni añadir el archivo a Git. No es necesario cambiar variables en Vercel para la herramienta.

```sh
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --dry-run
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --apply
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --verify
```

Si aparecen otros usuarios reales, la vista previa los identifica y el reemplazo **se bloquea**, también en SQL. No se desvinculan ni eliminan. Hace falta acordar un procedimiento específico antes de continuar; no hay opción para saltarlo.

Para asociar más adelante usuarios reales a las reservas, conservar una copia de esta configuración con la misma fuente, semilla y fechas; añadir sus UUID reales a `users` y seguir `seed:online-demo --bind-users` en [ONLINE_DEMO_SEED.md](ONLINE_DEMO_SEED.md). No cambiar la configuración de sustitución: esta solo acepta al administrador. La asociación posterior también se ha probado en PostgreSQL y no crea cuentas ni altera plantillas.

Las RPC comprueban procedencia demo, administrador, Auth y membresía. Bloquean perfil y agregado en el mismo orden que las operaciones normales, verifican la huella y hacen en **una transacción**: captura completa, reemplazo, actualización de slots/metadatos/membresía, incremento de revisión, publicación de `game_revisions` y auditoría. Los comandos con CAS anterior no pueden sobrescribir el nuevo estado. El lease anterior de Cron queda invalidado; sus fallos tardíos no alteran la liga sustituida. RLS permanece activo y solo `service_role` puede ejecutar las RPC; navegador, anon y authenticated no acceden a los respaldos.

El respaldo inmutable en `monigones_private.demo_backups` incluye fila del agregado, cabecera de liga, control de importación, slots, membresías, recibos y revisión, con SHA-256 calculado por PostgreSQL. `demo_replacements` y `demo_runs` registran la operación. Se conserva también tras un fallo al exportar el archivo privado. La exportación local `<UUID>.postgres.json` contiene datos privados: no publicarla ni enviarla a Git. La carpeta ignorada contiene informes resumidos sin secretos. Cada respaldo conserva el agregado completo y consume almacenamiento; no se purgan copias automáticamente. Revisar la retención y el espacio disponible antes de repetir operaciones. No hay dependencias nuevas de servicios de pago ni escritura en el filesystem de Vercel: la CLI se ejecuta en el ordenador del operador y la transacción persiste en Supabase.

Si falla únicamente la exportación tras confirmar, seguir el mensaje y repetir el mismo comando con `--operation UUID_RESPALDO`. La RPC devolverá `already_applied` y se recuperará el respaldo; un archivo local existente solo se acepta si coincide íntegramente.

Restauración online:

```sh
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --restore UUID_RESPALDO --dry-run
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --restore UUID_RESPALDO --apply
npm run demo:replace -- --target production --config .monigones-demo/replacement.production.json --env-file .monigones-demo/credentials.env --verify
```

La frase es `RESTAURAR <entorno> <proyecto> <liga> <nuevo_UUID_respaldo> DESDE <UUID_original>`. Verifica integridad y destino; crea un respaldo del estado que se está abandonando y restaura únicamente esa liga. La comparación SQL impide alterar recursos u otros campos de negocio del respaldo bajo apariencia de restauración.

## Reloj, recuperación y aceptación

Producción toma la hora de PostgreSQL. La nueva demo empieza ahora, `timeOffset=0`, mercado a las 06:00 Europe/Madrid incluyendo horario de verano, sin liquidar jornadas o conceder recompensas históricas. No se reconfigura Supabase Cron.

Al recuperar una copia se conservan contratos, recursos, progreso, identidades y duraciones relativas; se rebasa el reloj al presente para evitar una avalancha de vencimientos históricos. Se incrementa la revisión y se renuevan generación, invitación y RNG privado. La copia original permanece intacta. Por tanto la recuperación es del contenido de negocio, no una reutilización literal de revisión/fechas antiguas.

Tras ejecutar remotamente: entrar con la **misma cuenta**, comprobar Cholo ATM, cinco equipos/reserva, mercado, 11 titulares y tres suplentes, salarios y recursos; abrir otra sesión para confirmar actualización Realtime y rechazo de acciones antiguas. El flujo real de Auth, WebSocket Realtime y Cron alojado requieren esa aceptación remota posterior. Las pruebas locales utilizan PostgreSQL real con roles/esquema Auth mínimos y fixtures HTTP; no sustituyen una prueba del servicio alojado.

## Validación y decisiones

Las pruebas nuevas ejercitan WAL, copia completa, reinicio, persistencia de sesiones, ausencia de sobrescritura automática, restauración, huellas obsoletas, corrupción de respaldo, fallo intermedio, reintentos, transacciones/bloqueos PostgreSQL, membresías, conservación de Auth, aislamiento, permisos, metadatos Realtime, Cron antiguo y fencing de comandos. Se añaden pruebas de navegador con sesión conservada después de sustituir una partida temporal.

Comandos reproducibles:

```sh
npm run check
npm run lint
npm test
# PostgreSQL 17+ instalado; MONIGONES_PG_BIN y MONIGONES_PG_SHARE si no está en PATH.
npm run test:postgres
npm run build
npm run test:e2e
npm run build:online
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
```

Resultados: TypeScript y ESLint aprobados; **210 unitarias**, **49 integraciones PostgreSQL**, **50 casos distintos de navegador** aprobados entre suite completa y reejecuciones (una omisión histórica); ambos builds y **36 comprobaciones HTTP del artefacto real de Vercel con Node 24**. La ejecución inicial detectó tres expectativas antiguas de niveles/formación/banquillo y la prueba nueva necesitó distinguir el mensaje publicado del texto del compositor; todas quedaron revalidadas. También se ejecutó la CLI en terminal interactiva contra una SQLite temporal, sustituyendo, generando informes y restaurando. Registro detallado: [results.json](validation/demo-replacement/results.json). Los tests históricos ajustan sus fixtures cuando necesitan edificios de nivel 1; no fuerzan esos niveles en la nueva demo. Se conserva una instantánea histórica exclusivamente en tests para probar recuperación, no como segunda fuente de demostración.

Decisiones autónomas: reservas explícitas sin Auth; rechazo de otras membresías; respaldo transaccional privado con exportación local; UUID de operación para reintentos; restauración con reloj rebasado y revisión creciente; encabezado de generación; fuente compartida entre navegador/servidor; compatibilidad con escudos WebP sin exigir PNG opcionales antiguos. No se han modificado recursos PNG/WebP, catálogo deportivo, reglas ni servicios remotos.

**Pendiente:** autorización para instalar la migración remota, publicar en Vercel, leer la vista previa de las partidas reales y sustituirlas. La demo existente sigue intacta hasta ejecutar esos pasos explícitamente.
