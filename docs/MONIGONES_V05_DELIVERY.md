# Monigones v0.5 · navegación, formaciones y pulido visual

Preparación local, 24–25/10/2026. Se mantiene la arquitectura SQLite local / Supabase online, PWA y Vercel Functions. No se ha modificado ningún servicio remoto, ejecutado importaciones, desplegado ni abierto la partida del usuario. Los cambios de estado de las pruebas pertenecen exclusivamente a ligas y bases desechables.

## 1. Jornada: indicador superior y panel contextual

Se ha retirado el banner inferior. `CityMatchday` ocupa la misma zona superior que Mapa/Secciones, alineado a la derecha y con distribución adaptable. La barra ocupa espacio propio: el indicador contraído no cubre edificios ni etiquetas del Canvas.

El control muestra jornada, estado y cuenta atrás hasta un acontecimiento real:

- Previa: cierre de convocatoria; después, inicio del primer encuentro.
- Jornada en curso: siguiente inicio o final de partido según el calendario guardado.
- Finalizada: siguiente cierre de convocatoria, cuando exista otra jornada.

El panel muestra fechas en Madrid, titulares, suplentes, coste previsto/cobrado y validez de convocatoria. Durante el juego muestra partidos, puntos **base provisionales**, pendientes y cupos restantes de cambios; las condiciones concretas siguen siendo validadas por el motor. Tras la liquidación presenta puntos, posición fantasy, conceptos económicos y el trofeo de jornada si existe. No se inventa un resultado entre clubes ni se atribuyen puntos deportivos todavía no liquidados.

El motor avanza inmediatamente a la siguiente jornada tras liquidar. Para que el informe no desaparezca en Ciudad, se ofrece el último resultado durante las 24 horas posteriores al final programado, siempre que la nueva jornada siga en previa. Se consulta el informe correcto mediante `/matchday?round=N`. Después vuelve a la próxima jornada.

El panel se abre/cierra con el control, Escape o una pulsación fuera. No utiliza una cortina sobre el mapa ni cancela sus eventos; se puede seguir arrastrando fuera del panel. Las rutas de detalle desmontan el panel.

## 2. Reloj y calendario

`GameClock` mantiene una única suscripción de UI para los contadores. Interpola desde la hora del último estado recibido del servidor usando tiempo monotónico, y se resincroniza con cada nuevo estado. `Countdown` reutiliza ese reloj. No se ejecuta lógica de jornadas en el navegador ni se modifica `state.now` desde el contador.

Los estados siguen viniendo del servidor. Si falta información o termina la temporada, no se fabrica otra fecha; se muestra ausencia de próximo evento. Sin conexión, la aplicación conserva su aviso de que consulta la última copia.

## 3. Navegación compartida de Ciudad

`CityShortcuts` se monta una única vez en el contenedor común de ambas vistas:

- Actividades y su progreso.
- Eventos y avisos.
- El Balonazo y avisos.
- Obras, contador y panel de trabajos existente.

El cambio de vista no recrea los accesos ni sus contadores. En Mapa flotan sobre el escenario; en Secciones permanecen accesibles en el mismo lugar. El scroll pertenece al contenido de Secciones y reserva espacio inferior para que la última instalación quede por encima de la barra. Se mantienen los quince accesos, notificaciones, permisos y destino de cada edificio.

## 4. Catálogo táctico y desbloqueos

La fuente compartida es `shared/formations.ts`; frontend, costes y validación de comandos utilizan el mismo catálogo.

| Césped mínimo | Sistemas añadidos |
| --- | --- |
| 0, inicial | 4-4-2, 4-3-3, 4-5-1 |
| 1 | 3-5-2, 4-2-3-1, 5-4-1 |
| 2 | 3-4-3, 4-1-4-1, 5-3-2 |
| 3 | 4-3-2-1, 3-6-1, 5-2-3 |
| 4 | 4-2-4, 3-3-4 |

Los niveles son acumulativos. Hay **catorce formaciones jugables**, todas con un portero y diez jugadores de campo. El último nivel añade alternativas ofensivas sin bonificaciones adicionales, descuentos ni cambios de reglas económicas.

### Referencia solicitada 3-4-4

3 defensas + 4 medios + 4 delanteros suman once jugadores **de campo**; añadiendo portero serían doce. El juego exige un POR independiente y no tiene una convención que incluya al portero dentro de esas cifras. Por tanto, **3-4-4 no es seleccionable en ningún nivel**, incluido césped 4. No se oculta ni resta un jugador. Se mantiene aquí la referencia y se usa **3-3-4**, junto a **4-2-4**, como alternativa ofensiva exclusiva del nivel 4.

## 5. Integración y compatibilidad

`Selection.formation` es opcional y diferencia dibujos con las mismas demarcaciones totales, como 4-5-1 y 4-2-3-1. Las líneas intermedias siguen siendo MED; no se crean nuevas posiciones, salarios ni bonificaciones.

- Las partidas anteriores conservan sus once casillas, jugadores, suplentes y calidades. Si no hay nombre guardado, se infiere el sistema por las posiciones existentes, sin escribir ni transformar la partida al leerla.
- Los cinco sistemas anteriores siguen existiendo y sus nuevos umbrales son iguales o más permisivos. No se invalidan convocatorias congeladas por la actualización.
- Una selección explícita de otra táctica conserva los titulares compatibles por demarcación, sin duplicarlos. Las plazas nuevas pueden quedar vacías; se indica revisar el once. Los jugadores que dejan de caber permanecen en la plantilla. El banquillo compatible se conserva.
- La calidad y su desbloqueo pertenecen a cada índice de casilla y se conservan. No se obtienen mejoras gratuitas al cambiar dibujo.
- El nombre táctico se conserva también al pasar a la siguiente jornada.
- El servidor comprueba el césped; manipular una petición no desbloquea sistemas. `callCost` verifica once titulares y una distribución válida, además de las comprobaciones existentes de propiedad, posición, duplicados y suplentes.
- Los cambios manuales/automáticos siguen utilizando posición, minutos, estado de encuentros, investigación y cupos existentes.
- La táctica rival se oculta antes del cierre, igual que sus titulares y banquillo.
- El mercado filtra las cuatro demarcaciones actuales y no mostraba una lista derivada de necesidades tácticas; su funcionamiento sigue siendo compatible.

El estado online se persiste en el agregado JSONB existente. **No se necesita ni se ha añadido una migración SQL.** No se han modificado contratos, presupuestos ni ligas reales para actualizar el catálogo. El cambio llega a ambos motores al publicar el código.

## 6. Selector y representación sobre el campo

`FormationPicker` sustituye el desplegable genérico por un selector táctico:

- Lista desplazable de sistemas, césped requerido, disponibilidad y selección actual.
- Vista previa con once puntos y líneas reales. Por ejemplo, 4-2-3-1 muestra dos filas MED independientes, también en el campo principal.
- Los sistemas bloqueados se pueden **previsualizar**, pero Aplicar está deshabilitado; el servidor vuelve a validar cualquier comando.
- Confirmación explícita de aplicación, respetando el estado de convocatoria y conectividad.
- Modal ajustado a viewport y áreas seguras, cierre exterior/Escape, foco y controles personalizados existentes.
- Distribuciones de hasta seis medios con columnas adaptables; los once controles de jugador permanecen accesibles.

## 7. Banquillo

El bloque «Siempre preparados» tiene encabezado compacto, dos indicadores alineados y una explicación más breve. Con capacidad cero explica el primer nivel de Banquillo y ofrece acceso al estadio. No habilita botones de añadir cuando no hay plazas o ya existe un suplente de la misma demarcación; siguen disponibles las retiradas permitidas. Los botones tienen nombres accesibles y se mantienen los límites autoritativos anteriores.

## 8. Auditoría visual y correcciones adicionales

Se revisan acceso/registro, ambas vistas de Ciudad, Mi club, plantilla/alineación/convocatoria/banquillo, mercado, draft, los quince edificios, estadio e instalaciones, investigación, finanzas, actividades, eventos, periódico/El Balonazo, obras, liga/clasificación, chat, negociaciones, configuración y las demás rutas de gestión existentes.

Hallazgos y cambios:

| Hallazgo | Corrección |
| --- | --- |
| Banner inferior de jornada competía con los accesos y el mapa | Control superior propio y detalle contextual |
| Accesos de Secciones quedaban al final del scroll | Barra compartida permanente dentro de Ciudad y espacio reservado |
| Selector táctico genérico no distinguía filas y desbloqueos | Selector específico y catálogo compartido |
| Filas densas podían superponer retratos al añadir seis MED | Columnas dinámicas, retratos ajustados y pruebas de geometría |
| Bloque de banquillo y títulos de sección demasiado grandes | Organización compacta y tipografía equilibrada |
| Cartas de mercado muy altas para cinco agentes | Reorganización visual de la carta, conservando imagen, valor, puntos, identidad, estado y acceso a la ficha |
| Texto de investigaciones pequeño en columnas estrechas | Icono más compacto y texto/contraste/tamaño más legibles |
| Hora y moderación del chat ocupaban filas separadas | Pie común, hora semántica y mejor superficie táctil |
| Pie de Ajustes afirmaba servidor local en el juego online | Texto neutral «Tu club, tu liga» |

Se conservan azul oscuro, dorados, gráficos y controles personalizados. Las capturas se toman sobre el viewport con animaciones CSS estabilizadas; no se confunde un documento completo detrás de un modal fijo con lo que ve el usuario.

## 9. Native Messaging

Se buscaron `NativeMessaging`, `console-log.service`, `connectNative`, `sendNativeMessage` y los puentes de runtime en el código de la aplicación. No se encontraron llamadas de Monigones a mensajería nativa. El navegador limpio de la auditoría no produjo ese mensaje ni errores JavaScript.

Chrome documenta Native Messaging como comunicación de **extensiones** con una aplicación nativa; «Native host has exited» indica que se cerró su canal. La traza facilitada solo incluye `console-log.service.ts:59`, sin origen de script ni identificador de extensión. Es compatible con un componente externo, pero **no identifica por sí sola una extensión concreta ni demuestra el origen exacto del aviso del usuario**.

El usuario confirmó que lo ve en F12 al abrir el dominio `.vercel.app`. Esa dirección corresponde a la página inspeccionada y no aporta todavía el origen del archivo `console-log.service.ts`. Sin la URL del script o su traza completa, queda **no reproducido en navegador limpio y pendiente de atribución en el perfil original**. No se han añadido filtros, sobrescrito `console` ni modificado el juego para ocultarlo. Referencia: [documentación oficial de Chrome](https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging).

Evidencia: [native-messaging.json](validation/v05/native-messaging.json).

## 10. Archivos principales

- Motor/tipos: `shared/formations.ts`, `shared/config.ts`, `shared/types.ts`, `shared/engine.ts`.
- Resumen/tiempo: `shared/matchday-summary.ts`, `src/components/GameClock.tsx`, `src/components/ui.tsx`, `src/lib/api.tsx`.
- Ciudad: `src/components/CityMatchday.tsx`, `src/components/CityShortcuts.tsx`, `src/pages/CityPage.tsx`.
- Plantilla: `src/components/FormationPicker.tsx`, `src/pages/SquadPage.tsx`.
- Otras interfaces: `src/pages/LeaguePage.tsx`, `src/pages/SocialPages.tsx`, `src/pages/SettingsPage.tsx`, `src/game.css`.
- Metadatos/build: package y lock 0.5.0, identidad de build en `vite.config.ts`.
- Pruebas: `tests/v05.test.ts`, `tests/game-clock.test.tsx`, `tests/e2e/v05.spec.ts`, escenario PostgreSQL ampliado y adaptación de expectativas v02/v04 a los componentes nuevos.

## 11. Pruebas y resultados

| Comprobación | Resultado local | Evidencia |
| --- | --- | --- |
| TypeScript, frontend y grafo NodeNext online | Correcto | [typescript.log](validation/v05/typescript.log) |
| ESLint | Correcto | [eslint.log](validation/v05/eslint.log) |
| Vitest | **190 pruebas**, 13 archivos | [unit.log](validation/v05/unit.log) |
| PostgreSQL 17 desechable | **42 pruebas**, 2 archivos | [postgres.log](validation/v05/postgres.log) |
| Navegador | **44 casos distintos aprobados**: 38 regresiones previas y 6 de v0.5; 1 archivo visual histórico omitido | [auditoría](validation/v05/visual-audit.json) · [v05](validation/v05/browser-v05-final.log) · [detalle/rutas adicionales](validation/v05/browser-details-final.log) |
| Build SQLite/local | Correcto | [build-local.log](validation/v05/build-local.log) |
| Build Supabase/online aislado | Correcto | [build-online.log](validation/v05/build-online.log) |
| `npx vercel build --prod` | Correcto, **sin desplegar** | [build-vercel.log](validation/v05/build-vercel.log) |
| Function construida, ESM nativo fuera del repositorio | **36 comprobaciones HTTP**, Node **24.22.1**, runtime `nodejs24.x` | [artifact-native-node24.log](validation/v05/artifact-native-node24.log) |
| PWA del resultado real de Vercel | **51 recursos**, identidad/configuración coherentes | [artifact-pwa.log](validation/v05/artifact-pwa.log) |
| Recursos gráficos | **522/522 PNG idénticos por SHA-256**, sin cambios en `public` | [production-artifact.json](validation/v05/production-artifact.json) |

La prueba nativa copia `.vercel/output/functions/api/[...path].func` fuera del proyecto y no hereda sus credenciales, módulos locales ni cargadores TypeScript. Carga el handler `api/[...path].js` y ejecuta rutas de salud, sesión, membresía/estado, comandos y Cron contra fixtures HTTP locales. Las entradas `RPC_INVALID_JSON` y `RPC_REJECTED` del log corresponden a fallos inyectados intencionadamente para comprobar respuestas de error; no son llamadas a producción.

La primera ejecución completa del navegador aprobó **41 casos**, omitió el archivo visual histórico anterior y agotó los 300 segundos asignados al recorrido de 195 rutas/tamaños. Se corrigió también una espera que podía capturar el encabezado de carga en lugar de la pantalla. El recorrido definitivo espera cabecera y contenido real, fuentes y desaparición de avisos transitorios; conserva las comprobaciones geométricas y de consola. Su límite se ajustó a diez minutos para esta auditoría extensa; el recorrido definitivo pasó en 3,7 minutos. La ampliación añade 15 combinaciones de ficha de jugador, museo rival y créditos: **210 comprobaciones de rutas/tamaños**, además de las escenas de Ciudad, selectores y detalles. En la ampliación de ficha/museo/créditos se concretó también el selector del título, porque la ficha incluye dos encabezados de nivel 1. Las capturas detalladas centran la tarjeta y verifican que quede por encima del menú fijo. Véase [el primer intento](validation/v05/browser-regression-initial.log).

Se ejecuta PostgreSQL real en un clúster **nuevo, temporal y desechable de localhost**, conforme a la autorización expresa anterior del usuario para ese procedimiento. El script prepara su esquema usando los archivos existentes y elimina únicamente su propio clúster al finalizar. Para esta ejecución se utilizaron los binarios aislados ya disponibles en la caché temporal de la estación:

```sh
MONIGONES_PG_BIN=/tmp/monigones-postgresql/postgresql@17/17.11_1/bin \
MONIGONES_PG_SHARE=/tmp/monigones-postgresql/postgresql@17/17.11_1/share/postgresql \
npm run test:postgres
```

Esas rutas no forman parte del hosting ni de la aplicación; para repetirlo con una instalación propia, configura `MONIGONES_PG_BIN` apuntando a su carpeta `bin` o añade PostgreSQL 17+ al `PATH`. No ejecuta nada contra Supabase remoto ni usa la partida SQLite del usuario.

Las pruebas online utilizan PostgreSQL real y el cliente oficial de Supabase contra fixtures locales de los protocolos Auth/Realtime. No se ejecuta un servicio Auth remoto ni se valida la infraestructura alojada con estos fixtures. El artefacto Vercel se carga fuera del repositorio con ESM nativo y Node del mismo major que el runtime declarado. No se equipara esa comprobación a un despliegue remoto ni a dispositivos físicos.

Resultados estructurados: [results.json](validation/v05/results.json). Las seis pruebas nuevas se validaron en la ejecución principal de cinco casos y la repetición final de dos, con un caso compartido; no se suman ejecuciones repetidas como pruebas distintas. Al comprobar las dimensiones de todos los PNG se detectaron cinco nombres 390×844 con el viewport predeterminado 390×664 del dispositivo emulado; se fijó el tamaño explícito y se repitieron sus dos escenarios. Las 315 capturas finales tienen exactamente las dimensiones indicadas en su nombre: [repetición de viewport](validation/v05/browser-viewport-final.log).

## 12. Capturas

[Galería v0.5](screenshots/v05/index.html), **315 capturas**, con 320×568, 375×812, 390×844, 430×932 y escritorio centrado. Incluye control de jornada, panel, previa/directo/final, vistas de Ciudad, accesos compartidos, tácticas bloqueadas/disponibles, previsualización, dibujos de varias líneas, seis medios, banquillo y auditoría de las demás pantallas.

La galería v0.5 procede de Chromium automatizado y partidas desechables. La suite anterior también ejecutó escenarios con WebKit y emulación de Chrome Android. No son capturas de las cuentas ni teléfonos del usuario. Los recursos del juego se conservan; las capturas históricas se restauran tras ejecutar las pruebas y la evidencia nueva se guarda separada.

## 13. Repetir validación y publicar posteriormente

```sh
npm ci
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
# PostgreSQL 17+ local; solo clúster desechable creado por el script:
npm run test:postgres
# Variables públicas existentes o .env.online.local:
npm run build:online
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
node scripts/verify-pwa-build.mjs .vercel/output/static
```

No hay variables, importaciones ni tareas Cron nuevas. Se mantienen las variables existentes y la publicación normal de los 522 PNG. Para usar SQLite después de un build online, ejecuta `npm run build` antes de `npm start`; el modo de desarrollo permanece en `npm run dev`.

**Publicación voluntaria**, después de revisar el informe y las capturas:

```sh
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
node scripts/verify-pwa-build.mjs .vercel/output/static
npx vercel deploy --prebuilt --prod
```

El último comando modifica producción y **no se ha ejecutado**. No hace falta ejecutar SQL, reimportar la demostración ni activar Cron para v0.5.

## 14. Decisiones autónomas

1. Excluir 3-4-4 inválida; reservar 3-3-4 y 4-2-4 al césped 4.
2. Separar líneas tácticas de demarcaciones económicas/deportivas existentes.
3. Añadir metadata opcional para conservar dibujos de varias líneas sin migrar ni reescribir partidas antiguas.
4. Conservar jugadores compatibles, suplentes y calidad de casillas al aplicar una táctica.
5. Ocultar el nombre de la táctica rival antes del cierre.
6. Compartir navegación de Ciudad y usar reloj visual común con referencia de servidor.
7. Mostrar el informe reciente durante 24 horas para que el avance automático de jornada no lo haga desaparecer.
8. Corregir mercado, investigación, banquillo, títulos y pie del chat según las capturas.
9. Mantener los gráficos, costes, premios, puntuación y reglas de sustitución existentes; no añadir servicios ni pagos.
10. Distinguir la ausencia del aviso Native Messaging en limpio de su atribución concreta en el perfil del usuario.

## 15. Pendientes reales

- Identificar el origen exacto de `console-log.service.ts` en el navegador que produjo el aviso; no se declara arreglado un host nativo que no se controla.
- Publicación y aceptación remota por el propietario. No se ha modificado Vercel/Supabase alojado.
- Verificación en Android/iPhone físicos: teclado nativo, safe areas del dispositivo, instalación y sonido reales. Las pruebas automatizadas no las sustituyen.
