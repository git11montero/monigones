# Login online: respuesta vacía de una RPC void

## Causa reproducida

`public.online_profile(uuid,text)` está declarada `RETURNS void` en `202610240001_online.sql`. PostgREST devuelve **204 No Content** para estas funciones. El transporte anterior de `server/online/transport.ts` ejecutaba `response.json()` en todas las respuestas, incluso sin cuerpo. El resultado era `Unexpected end of JSON input`.

Tanto `POST /api/login` como `GET /api/session` verifican primero el Bearer y después llaman a `store.profile(user)`. El fallo ocurría en esa respuesta RPC antes de devolver el login o consultar la membresía. El GET de sesión no intentaba interpretar un cuerpo de petición. No es necesario cambiar usuarios, migraciones, miembros ni volver a importar la demo.

Se ejecutó `npx vercel build --prod` con el código anterior y se cargó la función resultante, copiada fuera del repositorio, con Node 24.22.1. Al hacer que el servidor HTTP local de PostgREST respondiera 204 a `online_profile`, el artefacto devolvió exactamente `GET /api/session: Unexpected end of JSON input`, HTTP 400. La prueba anterior enviaba `null` JSON en lugar de un 204 y ocultaba esta incompatibilidad del fixture.

Referencias primarias: [PostgREST: 204 para RPC que devuelve void](https://postgrest.org/en/v11/releases/v10.0.0.html), [Vercel: getter y formatos de request.body](https://vercel.com/docs/functions/runtimes/node-js#request-body).

## Correcciones

- `server/online/transport.ts`: consume la respuesta una sola vez. Acepta cuerpo vacío únicamente para las firmas void conocidas `online_profile` y `online_tick_failed`. Conserva las representaciones JSON antiguas `null` y rechaza respuestas vacías/ilegibles cuando se espera JSON. Distingue errores de transporte, protocolo y rechazo SQL.
- `server/online/http.ts`: errores HTTP explícitos, lectura de objetos JSON obligatorios u opcionales y diagnósticos sin cuerpo, cabeceras, tokens, contraseñas o claves. Los errores nativos de programación devuelven 500; las invariantes de negocio del motor conservan sus mensajes y rechazo 400.
- `server/online/handler.ts`: GET de sesión no lee ningún cuerpo. Login/logout aceptan ausencia de cuerpo o un objeto JSON válido; comandos y ligas requieren un objeto. No interpreta un token del cuerpo. Distingue un token inválido (401) de la indisponibilidad de Auth (503), evitando tratar una caída de infraestructura como una contraseña incorrecta.
- `api/[...path].ts`: no consulta el helper de cuerpo en GET/HEAD. Lee `req.body` una única vez, reconoce objetos/texto/Buffer ya procesados por Vercel y no vuelve a consumir un stream cuando el helper ya proporciona los datos. Si se perdió un cuerpo consumido sin helper, responde 400 con código propio. Los errores del getter JSON se clasifican como entrada inválida. Verifica el tamaño también para cuerpos ya procesados y elimina el `Content-Length` anterior al reserializar.
- `src/lib/api.tsx`: añade `Content-Type` solo cuando hay cuerpo. Conserva el envío de `Authorization: Bearer …` mediante el SDK compartido. Un error HTTP vacío/no JSON mantiene su estado y produce un mensaje explícito en lugar del error de `JSON.parse`.
- `src/pages/AuthPage.tsx`: tras Auth, el login online envía un POST sin cuerpo; la identidad va exclusivamente en el Bearer. Se conserva el puente Auth local antiguo que utiliza `accessToken` en su petición y el acceso SQLite habitual.
- Pruebas y fixtures: ahora el contrato de PostgREST utiliza 204 para `online_profile`, tanto en la función compilada como en los puentes HTTP con PostgreSQL real.

No hay cambios de reglas, datos deportivos/económicos, esquema, catálogo, gráficos, configuración remota o contenido de la demo existente.

## Respuestas esperadas

| Situación                                            | Respuesta                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| RPC void con 204 vacío                               | Éxito interno sin parseo JSON; login/sesión pueden devolver 200 |
| Sesión sin Bearer                                    | 200, `user: null`, `membership: false`                          |
| Login sin Bearer, incluso con accessToken en el JSON | 401                                                             |
| Login con Bearer válido y sin cuerpo / `{}`          | 200                                                             |
| JSON malformado o valor que no es objeto             | 400, `INVALID_JSON` o `JSON_OBJECT_REQUIRED`                    |
| Comando/liga sin cuerpo                              | 400, `JSON_BODY_REQUIRED`                                       |
| Stream consumido y cuerpo original no disponible     | 400, `BODY_ALREADY_CONSUMED`                                    |
| Cuerpo superior a 512000 bytes                       | 413, `BODY_TOO_LARGE`                                           |
| RPC que esperaba JSON pero recibe vacío              | 502, `RPC_EMPTY_RESPONSE`                                       |
| Respuesta RPC con JSON inválido                      | 502, `RPC_INVALID_JSON`                                         |
| Rechazo SQL de negocio                               | 400, `RPC_REJECTED`, conservando su mensaje                     |
| Fallo de conexión a Supabase / Auth no disponible    | 503, `RPC_UNAVAILABLE` / `AUTH_UNAVAILABLE`                     |
| Error de ejecución interno                           | 500, `INTERNAL_ERROR`, con diagnóstico seguro en logs           |

Un 200 vacío inesperado de una RPC que requiere datos sigue siendo un error. No se reemplazan indiscriminadamente respuestas rotas por `{}` o `null`, ni se afirma éxito ante fallos reales de Supabase.

## Validación local

- `npm run check`: correcto, incluyendo NodeNext.
- `npm run lint`: correcto.
- `npm test`: **132 pruebas correctas**, nueve archivos.
- `npm run test:postgres`: **41 pruebas correctas**, dos archivos, en PostgreSQL 17.11 nuevo y desechable. Incluye Auth por HTTP con SDK oficial, ejecución real de la RPC de perfil representada como 204, sesión de Presidente 1, membresía y lectura de los 500 jugadores de una demo creada únicamente como fixture local.
- `npx vercel build --prod`: correcto; ejecuta también `build:online`, TypeScript y Vite/PWA.
- Artefacto real `.vercel/output/functions/api/[...path].func`: **36 comprobaciones HTTP correctas** con Node 24.22.1, fuera del repositorio y sin cargador TypeScript ni dependencias del checkout.

El test de artefacto comprueba GET sin cuerpo con un getter que fallaría si se accediese, POST vacíos/válidos/malformados, helper de objetos/texto/Buffer con stream previamente consumido, lectura única del helper, error de parser de plataforma, token solo en cabecera, membresía y vista de la liga, comandos, cron y respuestas RPC erróneas. Usa Auth/PostgREST HTTP en localhost y credenciales ficticias; no consulta producción. Los errores RPC deliberados producen logs con código, nombre de RPC y estado upstream, sin cuerpos ni cabeceras.

Las pruebas PostgreSQL ejecutan las migraciones y crean datos sintéticos exclusivamente en el clúster temporal, que se detiene y elimina. No repiten la importación en el proyecto remoto. La prueba de protocolo no sustituye al stack oficial completo de Supabase o al entorno alojado de Vercel.

El helper de Vercel se reproduce con un getter local según su contrato documentado. El handler ejecutado sí es el JavaScript real del build de producción, pero no se envían estas peticiones a un despliegue remoto.

Evidencias: [results.json](validation/login-json/results.json), [reproducción original](validation/login-json/before-execution.txt), [ejecución corregida](validation/login-json/after-execution.txt).

## Volver a desplegar

Con el proyecto Vercel ya enlazado y sus variables actuales, ejecuta desde la raíz:

```sh
npx vercel pull --yes --environment=production
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
# Publica solo después de que la prueba anterior termine correctamente:
npx vercel deploy --prebuilt --prod
curl --fail https://monigones.vercel.app/api/health
curl --fail https://monigones.vercel.app/api/session
```

`pull` solo descarga configuración/variables a `.vercel/`, ignorada por Git. La última orden de Vercel publica; no se ha ejecutado durante esta corrección. Si usas Node 24 como versión local, también puedes ejecutar `npm run verify:vercel` para encadenar construcción y prueba del artefacto. Usa siempre la versión principal declarada en su `.vc-config.json`.

Los `curl` sin credenciales solo comprueban salud y sesión anónima. Para validar el usuario asociado, inicia sesión normalmente en la web y comprueba login 200, sesión 200 con `membership: true` y estado 200 con Presidente 1. No pegues Bearer, contraseñas o claves en comandos, logs o informes.

No requiere migraciones, nueva importación, borrado de usuarios/ligas, cambios de variables o modificación de cron. La validación remota autenticada queda pendiente del nuevo despliegue por el propietario.
