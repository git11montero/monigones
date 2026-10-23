# Base de datos

## Adaptador local activo

SQLite incorporado en Node, con WAL, claves foráneas y espera de bloqueos. En Node 22 el módulo muestra un aviso experimental. El archivo predeterminado es `data/crown.sqlite`; `CROWN_DB` lo puede cambiar.

Tablas activas: `users`, `sessions`, `leagues`, `memberships`, `receipts`, `sync_logs` y `job_runs`. La liga conserva un agregado versionado del motor. Las sesiones guardan el hash SHA-256 del token aleatorio y caducan; las contraseñas usan scrypt con sal aleatoria. El usuario tiene una única membresía activa por clave primaria. Las invitaciones locales son códigos aleatorios de 48 bits y solo el administrador puede leerlos. La API limita intentos generales, pero todavía no incorpora un sistema específico de invitaciones de un solo uso y expiración en el modo local.

Los recibos de idempotencia ligan usuario, clave, liga y comando. Reutilizar la clave con otro comando falla. El guardado del agregado y el recibo ocurre en una única transacción. Los eventos financieros se guardan en el libro mayor del agregado, con recurso, importe, saldo, motivo, referencia y fecha. Los sorteos registran probabilidad y resultado, sin entregar la semilla privada.

Respaldar con el proceso detenido requiere copiar el archivo SQLite y sus archivos WAL/SHM si siguen presentes; es preferible usar la API de backup de SQLite. No compartir el archivo activo por una carpeta de sincronización para simular varios servidores.

## Esquema Supabase preparado

`supabase/migrations/202610230001_crown.sql` define 69 tablas, índices, relaciones, unicidad de propiedad por temporada, restricciones, políticas RLS de lectura y una RPC transaccional de puja. Incluye usuarios/perfiles, ligas, temporadas, fútbol, draft, mercado, contratos, alineación, economía, obras, investigación, comercio, política, chat, periódico, eventos y archivo.

`supabase/seed.sql` se genera desde los mismos catálogos con `npm run catalogs`. Contiene clubes, jugadores, VM simulados, entrenadores y definiciones; no crea usuarios ficticios en `auth.users`.

La migración habilita RLS solo en las tablas que declara. Las escrituras económicas directas no se conceden a clientes autenticados. Las tablas de detalle sin una política de lectura permanecen cerradas hasta disponer de vistas o RPC seguras. La RPC de pujas incluye bloqueo, saldo reservado, VM de servidor, capacidad, salario y recibos. Es una base revisable, sin pretensión de implementar todavía todas las operaciones del motor en PostgreSQL.

**No se ha ejecutado esta migración en un PostgreSQL/Supabase disponible, ni se han probado sus políticas con usuarios reales.** Antes de usarla hace falta aplicarla en un proyecto nuevo de pruebas, validar DDL, ejecutar pruebas RLS cruzadas y completar el adaptador y las vistas. No existe sincronización automática SQLite → estas tablas. Configurar Supabase Auth solo cambia la autenticación, no la persistencia de la partida.
