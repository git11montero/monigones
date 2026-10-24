# Entrega del importador de demostración

## Resultado

Se ha continuado la implementación existente de ocho archivos. Las dos pruebas de `jobQuote()` ahora usan su firma real `(club, tipo, objetivo)` y siguen comparando el coste antes y después de preparar la instantánea. Se revisaron y completaron los generadores, exportación, servicio, CLI, migración, visualización de presidentes y comandos npm, sin rehacer el motor ni cambiar el frontend.

La demo online utiliza el mismo `createGame()` / `makeClub()` / `roster()` / `syncAttention()` de SQLite y el guardado real JSONB de producción. La creación y las asociaciones posteriores son transaccionales. El script no genera usuarios Auth, no copia credenciales, no sobrescribe ligas reales y no restablece demos que ya han cambiado.

## Archivos revisados y añadidos

Los ocho archivos de la implementación retomada son `package.json`, `server/online/store.ts`, `server/demo/state.ts`, `server/demo/service.ts`, `scripts/seed-online-demo.ts`, `scripts/export-local-demo.ts`, `supabase/migrations/202610250001_online_demo.sql` y `tests/online-demo.test.ts`.

Se añadieron `tests/online/demo.integration.ts`, `docs/examples/online-demo.config.example.json`, la [guía de uso](ONLINE_DEMO_SEED.md), este informe y [evidencias](validation/online-demo/results.json). Se actualizó `docs/ONLINE_SETUP.md` para enlazar el importador y reflejar la tercera migración. `.gitignore` excluye `.monigones-demo/` para configuraciones y exportaciones privadas.

## Fuente y modalidades

- **Inicial**: seis clubes originales, 500 jugadores del catálogo, recursos de `makeClub()`, sin contratos ni prima demo, draft pendiente.
- **Avanzada generada**: la demo recién creada en SQLite: seis clubes, 72 contratos, 78 asientos económicos, cinco jugadores de mercado, una jornada, seis eventos, una noticia y dos mensajes. No contiene niveles avanzados que el generador no crea.
- **Avanzada por instantánea**: progreso real de una demo explícitamente autorizada. Mantiene recursos, plantillas, edificios, instalaciones, investigaciones, actividades, mercado, jornadas, clasificación, contratos, patrocinio, conciertos e historial existentes, con referencias y fechas adaptadas al destino.

Se verificó que los UUID incidentales son reproducibles con semilla y fecha, que la exportación de un fixture SQLite no cambia su hash y que no contiene contraseñas, sesiones ni correos demo locales. La validación comprueba catálogo, relaciones y duplicados. También se desplazó `createdAt` de las pujas y se evitó cambiar textos que contienen UUID al trasladar referencias.

## Validación ejecutada

| Comprobación                     | Resultado                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                  | Correcto, configuración general y NodeNext                                                                           |
| `npm run lint`                   | Correcto                                                                                                             |
| `npm test`                       | 103 pruebas correctas en siete archivos; ocho del importador                                                         |
| `npm run test:postgres`          | 40 pruebas correctas en dos archivos; 20 del importador                                                              |
| Migraciones y seed en PostgreSQL | Tres migraciones y seed ejecutados en PostgreSQL 17.11 nuevo y desechable                                            |
| `npm run build`                  | Correcto; PWA local generada                                                                                         |
| `npm run build:online`           | Correcto; salida independiente en `/tmp/monigones-demo-online-build`, con URL y clave pública ficticias de localhost |
| Frontend y gráficos              | Sin cambios; 522 PNG conservados en ambas salidas                                                                    |

La primera prueba económica de integración intentaba pujar con las 12 plazas ocupadas. Se corrigió el test para vender primero mediante la API, respetando las reglas del juego. La ejecución final completa pasa.

La integración verifica ambas modalidades, membresías y presidentes, catálogo y recursos, plantillas, mercado, clasificación, progreso y trabajos, operaciones de venta/puja y lectura por la API, aislamiento de ligas, permisos/RLS, WAL de `game_revisions`, reintentos, concurrencia, duplicados, fallos al final de la creación y a mitad de una asociación, recuperación y rechazo de modificaciones no autorizadas.

Las pruebas de Auth usan el SDK oficial contra un servidor HTTP de fixtures en localhost. Las RPC y RLS se ejecutan en PostgreSQL real; la publicación de Realtime se comprueba en el WAL real. No se afirma haber probado en esta entrega los servicios oficiales remotos de Auth, Realtime o Cron. Los clústeres de pruebas se detuvieron y eliminaron al terminar.

La revisión automática bloqueó inicialmente la prueba por interpretar la prohibición de migrar como aplicable también al entorno local. Tras la autorización explícita del usuario se ejecutó exclusivamente en PostgreSQL local desechable. No hubo aplicación de la migración al Supabase remoto.

## Preparación pendiente en producción

No se ejecutaron migraciones ni scripts contra Supabase remoto, no se activó/modificó cron, no se cambió Vercel y no se leyó ni modificó la partida personal SQLite. La migración adicional debe revisarse y aplicarse por el propietario cuando autorice esa operación. Después puede ejecutar el dry-run, revisar el destino y confirmar la carga siguiendo [los comandos de la guía](ONLINE_DEMO_SEED.md#previsualizar-aplicar-y-verificar).

Se necesita como mínimo una cuenta real Auth asignada a `demo1`; pueden asociarse hasta seis presidentes. Los clubes pendientes no tienen cuentas ficticias ni sesiones. Los usuarios asociados no pueden pertenecer a otra liga debido a la regla existente de una membresía por cuenta. Para ver los nombres demo en producción debe estar publicado el pequeño cambio de lectura de `server/online/store.ts`; el script y la migración no lo despliegan automáticamente.

## Decisiones y límites

1. Mantener una única implementación deportiva/económica y persistir en el agregado activo, sin duplicar partidas en las tablas históricas.
2. Reservar clubes sin identidad Auth hasta que el propietario asocie cuentas reales, con una operación separada que conserva el progreso.
3. Usar el reloj de PostgreSQL por defecto, desplazar el checkpoint sin liquidar historia y programar mercado con Europe/Madrid.
4. Generar nuevos secretos privados en PostgreSQL; la semilla pública reproduce los datos, no predice resultados económicos futuros.
5. Bloquear restauraciones y reasignaciones. No se incluye un comando de reset, borrado o sustitución.
6. Exportar únicamente una fuente generada o una copia SQLite indicada expresamente. Un checkpoint incoherente, con tareas vencidas a su propio reloj, se rechaza en vez de corregirlo silenciosamente.
7. Permitir únicamente el catálogo actual de 500 jugadores y los seis presidentes demo originales. No se importan partidas personales, ligas de más clubes o catálogos personalizados con esta herramienta.
8. Exigir clave privada y confirmación interactiva; no habilitar una ruta pública de seed ni un modo `--yes`.

La oferta diaria puede cambiar al cambiar la fecha o UUID de liga, tal como establece el motor. UUID de liga/clubes, referencias, usuarios, ancla temporal, invitación y secreto económico se adaptan deliberadamente. La fuente, sus datos deportivos/económicos y el progreso no se inventan para rellenar huecos.
