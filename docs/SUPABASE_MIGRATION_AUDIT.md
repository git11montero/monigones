# Auditoría aislada de la migración Supabase · 23/10/2026

Revalidación estática del archivo completo: 24/10/2026, con el mismo analizador y sin conexión a una base de datos.

**Estado final: CONDICIONADA.** Supera análisis de gramática PostgreSQL, cuerpos SQL/PLpgSQL y orden de referencias. **No se ha aplicado a PostgreSQL ni a Supabase. No se declara lista para producción.**

Archivo: `supabase/migrations/202610230001_crown.sql`. Esta fase solo modificó ese SQL, este informe, el analizador estático y su evidencia. No modificó frontend, backend, arquitectura ni bases existentes. Se conservan las 69 tablas y los dos ENUM. No se ejecutó SQL remoto ni se abrió una conexión a una base local existente.

## Hallazgos y correcciones

Las cadenas `notnull`, `timestamptznot` y `referencespublic` **no estaban presentes** en la copia inspeccionada. No se atribuyen correcciones de errores inexistentes. Las declaraciones originales ya separaban esas palabras.

| Ubicación final aproximada | Hallazgo real | Corrección y motivo |
|---|---|---|
| Inicio, líneas 1–7 | Cabecera daba por preparado el modelo y dependía de permisos del esquema | Estado condicionado; retirada de CREATE a roles cliente y USAGE explícito. Migración inicial para base nueva. |
| Predicados, líneas 92–95; RPC 117–147 | `search_path=public` en funciones privilegiadas | `pg_catalog,pg_temp`, todas las tablas y funciones propias cualificadas. Evita resolver objetos de esquemas escribibles. |
| RPC, línea 123 | `digest` sin esquema fallaría si pgcrypto ya estuviera en `extensions` | SHA-256 nativo de PostgreSQL sobre UTF-8, independiente de dónde esté pgcrypto. Se conserva la extensión declarada. |
| RPC, líneas 122–144 | Entradas NULL no rechazadas explícitamente, catálogo futuro, mercado aún no abierto, temporada no activa | Validación anticipada de todos los parámetros; apertura/cierre y temporada activa; VM con fecha <= `now()`. |
| RPC, líneas 137–144 | Límite de plantilla omitía plazas reservadas; conflicto podía editar una adjudicación cerrada sin reabrir una retirada | Cuenta unión de propiedad, pujas y subastas; excluye la puja editada; bloquea estados liquidados y reabre solo retiradas/abiertas. |
| RPC, líneas 123–130 | Hash sin nombre de operación; perfil ausente no abortaba expresamente | Operación incluida en hash y perfil verificado después del bloqueo. Conserva transacción y serialización por usuario/mercado/saldo. |
| Permisos, líneas 146–162 | Auxiliares ejecutables por PUBLIC por defecto; privilegios de tablas dependían del proyecto | REVOKE para PUBLIC/anon; helpers y RPC permitidos a authenticated; SELECT condicionado por RLS; escrituras de tablas reservadas a service_role. Solo lista explícita de 69 tablas. |
| Políticas, líneas 101–114 | Configuración genérica legible podía incluir datos reservados; aviso personal no comprobaba pertenencia | Configuración cerrada sin política cliente hasta definir una proyección pública; avisos requieren usuario propio y pertenencia. |
| Constraints, líneas 164–193 | Estados, límites, costes, plazos y contadores con validación incompleta | CHECK adicionales de valores y estados. Dinero negativo sigue permitido para representar deuda; fama/prestigio/suerte/satisfacción acotados a 100. |
| Índices, líneas 194–197 | Consultas de destinatario/vencimiento sin índice específico | Índices de avisos usuario/liga/fecha, contratos, dependencias y negociaciones entrantes. |
| Triggers, líneas 200–300 | FKs individuales permitían unir entidades de temporadas/ligas distintas | Triggers de coherencia para pujas, subastas, convocatorias, negociaciones, cesiones, traspasos, eventos, préstamos, noticias, ediciones, mensajes, avisos y pagos. No conceden nuevas escrituras a clientes. |

## RLS, privilegios y datos personales

- Las 69 tablas activan RLS. No hay políticas INSERT/UPDATE/DELETE de cliente sobre recursos, contratos, ofertas ni progreso. La única RPC económica pública sigue siendo `place_market_bid`.
- Perfiles: solo el propio; no se añaden correos ni contraseñas al esquema público. Membresías y clubes: miembros de la misma liga. Noticias, chat, trofeos y ediciones: liga propia. Los mensajes moderados no son visibles.
- Saldos, libro mayor, trabajos, convocatorias y progresión: propietario. Negociaciones: participante. Pujas abiertas: propietario; adjudicadas: clubes visibles. Avisos: usuario propio y liga actual.
- Recibos idempotentes: usuario propio. Logs de proveedor, procesos y tablas de detalle sin política siguen cerrados a clientes, incluso con SELECT concedido. Es deliberadamente restrictivo; las vistas/consultas seguras necesarias para un adaptador Supabase completo siguen pendientes.
- Helpers SECURITY DEFINER devuelven booleanos y dependen de un propietario de confianza que puede consultar membresías sin recursión RLS. Hay que comprobar ese propietario en la prueba real. `service_role` debe permanecer solo en servidor; como en Supabase, su bypass de RLS es una frontera de confianza.
- Los triggers son SECURITY INVOKER, sin rutas escribibles de resolución, sin SQL dinámico de entrada cliente y sin concesión de ejecución directa. La creación de triggers se hace en la migración con propietario de confianza.

## Validación realizada

`psql 18.6`, `pg_ctl` e `initdb` están disponibles como herramientas cliente, pero no el ejecutable `postgres`. No se inicializó un clúster ni se utilizó una partida real.

Se instaló **pglast 8.7** en `/tmp/monigones-sql-parser`, fuera de las dependencias del juego. Comando reproducible desde la raíz:

```sh
/tmp/monigones-sql-parser/bin/python scripts/audit-supabase.py
```

Evidencia completa: `docs/validation/v02/supabase-static.json`. Resultado: **153 sentencias, 69 tablas, 107 referencias FK, 7 funciones, 3 cuerpos PLpgSQL y 7 bloques DO** analizados. Se analizan también los cuerpos de funciones SQL y el SQL generado por los bucles de políticas, permisos y triggers. Sin errores de gramática ni referencias adelantadas/desconocidas de tabla. Sin tablas eliminadas. No existen triggers en la versión anterior; los nuevos aparecen después de sus tablas/funciones.

El parser no resuelve catálogos, firmas, privilegios efectivos ni tipos de `NEW` contra una instancia. No sustituye una ejecución de PostgreSQL. En particular, las restricciones no son una prueba del motor de negocio completo.

## Verificación real pendiente y riesgos

Antes de aplicar a un entorno externo, usar **una base nueva y desechable**, con `auth.users`, `auth.uid()` y roles `anon`, `authenticated`, `service_role` equivalentes a Supabase. Ejecutar el archivo completo en una transacción y verificar:

1. Los 69 CREATE TABLE, extension/ENUM/defaults y constraints realmente resuelven en la versión objetivo.
2. Con dos ligas y varios usuarios, SELECT cruzado devuelve cero filas; anon no lee nada; authenticated no modifica economía ni membresías; logs/configuración no se filtran.
3. RPC con tokens de ambos usuarios, NULL/negativos, mercado futuro/cerrado, VM futuro, falta de fondos/plazas, reserva de subasta, reintentos iguales y claves reutilizadas.
4. Dos conexiones concurrentes sobre el mismo usuario/mercado: sin doble reserva ni sobrepasar capacidad. Orden de locks compatible con futuras RPC.
5. Los 17 triggers aceptan enlaces válidos y rechazan cruces de liga/temporada. Comprobar pagos y convocatorias históricas antes de definir operaciones que los editen.
6. Contratos finitos de patrocinio no se solapan mediante los comandos del servidor; no hay una CHECK dependiente de `now()` ni una falsa garantía por índice parcial.
7. Cambiar los identificadores de temporada de entidades padre sigue reservado al servidor; no hacerlo después de crear dependientes. Los triggers comprueban altas/ediciones de hijos, no implementan una migración de padres entre ligas.
8. La migración es de **primera instalación**, no es reejecutable sobre tablas ya creadas. Nuevas versiones sobre un Supabase instalado necesitarán una migración aditiva separada.

El adaptador activo continúa siendo SQLite. Esta revisión no convierte el esquema normalizado en un backend Supabase completo ni habilita Realtime remoto. Tampoco incorpora a SQL las funcionalidades nuevas del JSON local: hacerlo sería cambiar arquitectura dentro de la auditoría, fuera de este alcance.

Referencias primarias consultadas: [PostgreSQL CREATE FUNCTION](https://www.postgresql.org/docs/18/sql-createfunction.html) y [extensiones de Supabase](https://supabase.com/docs/guides/database/extensions).
