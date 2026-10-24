# Monigones v0.2 · Entrega de mejoras

Implementación: 23/10/2026. Cierre de verificación: 24/10/2026. Implementación incremental sobre el commit `f56d6f4`. No se ha reconstruido el juego, publicado una web ni aplicado SQL a Supabase remoto.

## 1. Resumen general

Se incorporan avisos persistentes, selectores propios, actividades con tiempo de servidor, privacidad de recursos, chat en el periódico, explicaciones de las 49 investigaciones, confirmaciones de cancelación y una ciudad con distritos conectados. Se añade una fotografía autorizada de Pedri y se realiza una auditoría SQL independiente. La cobertura fotográfica completa y la ejecución real de la migración siguen pendientes por motivos expresos, detallados más abajo.

| Área | Estado al cierre |
|---|---|
| Avisos, selectores, mapa, actividades, privacidad, chat y confirmaciones | Implementados y probados |
| Explicaciones de investigación | 49 descritas; dos efectos avanzados siguen identificados como pendientes |
| Fotografías | Integración y fallback probados; cobertura parcial de 7/390 identidades reales |
| Migración Supabase | Correcciones y análisis estático completados; ejecución/RLS reales pendientes |

## 2. Archivos modificados

- Reglas y datos: `shared/activities.ts`, `attention.ts`, `research-guide.ts`, `research-stories.ts`, `config.ts`, `engine.ts`, `types.ts`, `seed.ts`, `brand.ts` y `builtin-sports-photos.json`.
- Persistencia: `server/store.ts`, sin sustituir SQLite ni el protocolo de comandos/SSE.
- Componentes nuevos: `Attention.tsx`, `GameSelect.tsx`, `CampusGround.tsx`, `ResourceVisibility.tsx` y `UnsavedChanges.tsx`.
- Integración: `src/App.tsx`, `main.tsx`, `lib/api.tsx`, `lib/dialogs.ts`, `components/City.tsx`, `Experience.tsx`, `PlayerCard.tsx`, `PlayerPortrait.tsx`, `ui.tsx` y `game.css`.
- Pantallas: acceso, ciudad, edificios, finanzas, liga/jornada, gestión/actividades, mercado/ficha, investigación, ajustes, periódico/chat/negociaciones y plantilla.
- Recursos: JPEG fuente y WebP de Pedri; `data/sports-asset-catalog.json` regenerado.
- Auditoría aislada: `supabase/migrations/202610230001_crown.sql`, `scripts/audit-supabase.py` y `docs/SUPABASE_MIGRATION_AUDIT.md`.
- QA: `tests/v02.test.ts`, `tests/e2e/v02.spec.ts`, adaptación de pruebas existentes, `scripts/review-v02.mjs`, capturas y registros en `docs/validation/v02`.

## 3. Sistema de notificaciones

El módulo central deriva cada aviso de la partida autoritativa: ID estable/evento, tipo, destino, usuario, liga, prioridad, fecha, contador, leído y pendiente/resuelto. Se conservan lecturas y fechas de primera aparición/resolución por club/usuario en el JSON que ya persiste SQLite. Las acciones se registran en la misma transacción que el resto del juego y se propagan por SSE/refetch entre sesiones.

Los avisos informativos se reconocen al consultar su contenido; se envían únicamente los IDs mostrados. Un acontecimiento llegado en paralelo no se consume por una lectura anterior. Mercado distingue catálogo y pestaña de ofertas; el periódico distingue edición/categoría. Las acciones pendientes —ofertas, recompensas, deuda, problemas del once— siguen activas mientras exista la condición, aunque se marquen leídas. No se exponen las lecturas/preferencias/actividades privadas de otros clubes.

La agregación cuenta IDs únicos. Las categorías no crean copias de los avisos de sus hijos. La fecha y resolución quedan registradas incluso si una condición deja de existir; el listado activo se recalcula con el servidor.

## 4. Elementos que muestran globos

Mapa y selector de departamentos, accesos rápidos de ciudad, campana de noticias, navegación inferior, menú Mi club, accesos de edificios/oficinas, pestaña de ofertas del mercado, investigación y botón del chat del periódico. Tamaño pequeño, rojo, borde, iluminación discreta, aparición breve y `9+`; sin interceptar el toque.

Causas conectadas: noticias/ediciones, mercado renovado, deseados, pujas resueltas, traspasos/ventas/clausulazos, propuestas/cesiones, subasta especial, módulos desbloqueables, blindaje próximo a caducar, obras/investigación terminadas, mejoras/instalaciones/tecnologías accesibles, plantilla incompleta, felicidad baja, lesión, jornada próxima, cambios manuales disponibles, actividad nueva/lista, propuestas de patrocinio, espacios publicitarios y vencimientos, oferta semanal de conciertos, eventos nuevos/próximos al cierre/listos, mensajes ajenos, trofeos, préstamos próximos a vencer, liquidación y deuda.

No se inventan avisos de contratos pendientes o recompensas de estadio que el motor no modela como decisiones separadas. Los resultados automáticos se comunican mediante su transferencia, noticia o liquidación real. Los globos del mapa usan los límites medidos del sprite, no el margen transparente del atlas, y siguen la transformación de la cámara.

## 5. Selectores personalizados

Todos los `<select>` de la aplicación se sustituyen por `GameSelect`. Control propio con marco, selección, foco, estados bloqueados, opciones táctiles de 46 px y popup en portal. Admite flechas, Inicio/Fin, texto de búsqueda, Enter/Espacio, Escape y Tab. Usa roles combobox/listbox/option y conserva etiquetas de formularios.

El popup se ajusta a la ventana, cambia de lado cuando hace falta y no queda recortado por tarjetas/modales. Las formaciones bloqueadas se muestran con su requisito de césped. Las pruebas antiguas se adaptan al control real sin mantener selectores nativos invisibles para engañar a la cobertura.

## 6. Cambios del mapa

Se conservan los 15 edificios, sus atlas/niveles y la cámara con arrastre, rueda, pellizco y teclado. `CampusGround` sustituye las carreteras paralelas por un vial perimetral conectado y paseos de materiales diferentes. Añade bordillos/aceras, estacionamiento del estadio, cruces, explanada de aficionados, accesos, plazas, campos de cantera, vallas, un pequeño borde fluvial, manchas de césped y arboledas irregulares, setos, bancos, farolas, señalización y sombras.

Las superficies de entrada conectan cada edificio al terreno. Finanzas usa un entorno más urbano, investigación una plataforma tecnológica, cantera un campo vallado y competición una plaza. La sede gobierna pavimentación, bancos, zonas ajardinadas e iluminación; se conserva la evolución existente de personas/vehículos y el ambiente de partido/concierto. No se añadió un motor 3D ni una dependencia gráfica.

Antes/después exactos a 390×844 y otros tamaños: [galería interactiva](screenshots/v02/index.html). La procedencia del antes está en `screenshots/v02/PROVENANCE.md`.

## 7. Actividades y rarezas

Catálogo configurable de 20 actividades con narración, ilustración de departamento, coste, recompensa, extras y requisito de sede. Tres propuestas distintas por día; pesos de selección por propuesta: común 55, poco común 27, rara 13, épica 4 y legendaria 1. Las rarezas tienen marcos/colores propios.

Duraciones: comunes 30–45 min, poco comunes 90 min, raras 2–4 h, épicas 4–5 h y legendaria 8 h. Hay autógrafos, patrocinadores, peñas, gala, proyecto mundial y otras historias. No se añaden pagos reales ni riesgo aleatorio oculto. Las recompensas respetan los límites de atributos del motor.

## 8. Temporizadores y reinicio

`dailyStart` valida propuesta/requisitos, cobra y guarda una copia de la actividad, `startedAt` y `endsAt` en servidor. El alias anterior `daily` inicia la misma mecánica, sin recompensa instantánea. Solo una actividad sin cobrar puede existir. `dailyClaim` exige vencimiento y run ID correcto, premia una vez y guarda historial. La transacción/idempotencia evita dos inicios, dos cargos o dos cobros incluso con claves distintas.

La pantalla usa la hora recibida del servidor para la cuenta atrás. Cambiar la hora del dispositivo no autoriza el cobro. El servidor continúa reconciliando mientras no esté abierta la aplicación.

A las 06:00 de Madrid caducan propuestas sin iniciar y llegan otras tres. La actividad iniciada continúa, incluso lista para recoger. Si pertenece al día anterior, cobrarla no consume una propuesta nueva. Se conserva la penalización existente por menos de tres actividades completadas en el día. El laboratorio local incluye «Terminar actividad en curso»; ese avance está protegido por los permisos de pruebas existentes.

## 9. Marca y datos de demostración

Nombre visible centralizado: **Monigones**. Ciudad: «Tu club. Tu afición.» y «Tu ciudad deportiva». Se sustituyen lemas de reino/corona, iconos Crown, cabecera de liga, nombre genérico del estadio y bienvenida inicial. El patrocinador decorativo CORONA BANK pasa a GRADA BANK conservando el ID. **Real Corona y otros nombres legítimos no se cambian.** Las claves técnicas `crown-*` y nombres de archivos históricos se conservan.

Se retiran las etiquetas repetidas SIM/VM simulado/puntos simulados de cartas y pantallas habituales. Acceso, ajustes y procedencia explican «Datos de demostración». El motor actual sigue generando calendario/puntos/VM de la partida; no se anuncia un modo de resultados reales que aún no existe. Los metadatos de fuentes y las aclaraciones de créditos permanecen disponibles.

## 10. Ocultar recursos

Botón de ojo junto al sonido. Enmascara dinero, desarrollo y medallas del HUD y resúmenes relevantes de finanzas, presupuesto de mercado e investigación. Los efectos flotantes de cambios de saldo no revelan cantidades cuando se ocultan.

La preferencia se guarda en servidor por usuario, sobrevive a navegación/recarga y se sincroniza entre sesiones. No cambia saldos ni reglas. El libro mayor permite consultar expresamente sus detalles; precios, cotizaciones, reembolsos y costes de confirmación permanecen visibles.

## 11. Chat del periódico

`ChatPanel` se comparte entre `/chat` y `/newspaper`, con el mismo array de mensajes, comando, persistencia y SSE. Muestra presidente, club, escudo, hora y envío. Los nombres de presidentes se obtienen mediante una proyección limitada a la liga, sin correos ni contraseñas.

El panel inferior se abre sobre el periódico y sobre un artículo abierto, que permanece montado. Cerrar el chat devuelve al artículo. Se actualiza el indicador al leer mensajes; el desplazamiento automático respeta a quien consulta mensajes antiguos y ofrece volver a los recientes. Los mensajes se renderizan por ID sin duplicaciones. No se crea otra tabla ni un segundo sistema de chat.

## 12. Investigación

Las 49 tecnologías tienen una explicación propia en el catálogo de reglas. La ficha muestra nivel, beneficio exacto, actual/después, aporte por tecnología, acumulado del club, límite, requisitos, edificio, coste, tiempo y lo que desbloquea. Los ejemplos de salario, venta, mantenimiento, construcción y puntos usan RULES/effects y el redondeo económico existente. Se explican las calidades con su bonificación y sobrecoste salarial reales.

Los regalos únicos de suerte/satisfacción se distinguen de multiplicadores permanentes. Viral amplía el techo de fama; no aumenta premios de actividades ni probabilidades. Convenios bancarios es un requisito de progresión sin reducción de intereses. Identidad avanzada y equipaciones especiales aparecen explícitamente pendientes porque sus editores no están conectados. No se eliminan tecnologías ni se inventan beneficios.

`/bonuses` mantiene la auditoría por origen con unidades legibles y límites. Se normaliza también la exposición de los topes de mantenimiento/calidad en `effects`; las comprobaciones del motor ya aplicaban sus límites en el uso real.

## 13. Confirmaciones de cancelación

Modal propio para cancelar obra/cantera, retirar una puja y rechazar una propuesta. Obra usa los importes efectivamente pagados del trabajo: devuelve `floor(coste/2)` y muestra la pérdida restante de dinero/PD, tiempo transcurrido e irreversibilidad. Volver conserva el trabajo y sus fechas. Retirar una puja libera una reserva: no se presenta como un ingreso o una penalización. Rechazar una propuesta no mueve recursos.

El guard de borradores protege identidad, oferta y mensaje al navegar dentro de la aplicación, incluido el botón Atrás del navegador, con el mismo modal. Se utiliza el router de datos para bloquear realmente la navegación; las rutas/pantallas se conservan. Un cierre forzado de pestaña o recarga completa queda fuera de los bloqueos SPA; no se usa un `window.confirm` para fingir un modal propio en esos casos.

No se añaden botones para cancelar investigación, actividad, concierto o patrocinio cuando las reglas no permiten esa operación. Cerrar un panel o un selector sigue siendo una acción trivial sin gasto ni cancelación de contratos.

## 14. Fotografías incorporadas

**Una nueva:** Pedri (`barcelona-10`), fotografía de Bryan Berlin / WikiPortraits, Wikimedia Commons, CC BY-SA 4.0. WebP 512×769 de unos 55 KiB, JPEG original conservado, fuente/autor/licencia/modificación en el catálogo y créditos. Se mantienen seis fotos autorizadas anteriores: total siete.

Se comparten retratos y fallback por ID en fichas, draft, mercado, once, convocatoria y listas. Las noticias de nuevos fichajes incorporan un ID de jugador explícito para poder mostrar el retrato correcto; no se deduce de nombres en titulares.

## 15. Fotografías pendientes

383 identidades reales sin fotografía autorizada integrada; 110 avatares de identidades creadas para el juego. 493 avatares conservados. No se declara inexistente una imagen simplemente por no haberla localizado.

FútbolFantasy no concede reutilización por navegar según el aviso legal contrastado. No se descargó ni distribuyó su fotografía de referencia. Buba Sangaré existe como `elche-4`, pero conserva su avatar hasta obtener un recurso utilizable. [Informe de cobertura y fuentes](PLAYER_PHOTOS_AUDIT.md).

## 16. Auditoría Supabase

Fase separada que no hizo cambios de frontend/backend ni conectó a bases existentes. Se conservan 69 tablas, ENUM, RLS y la arquitectura. [Auditoría completa](SUPABASE_MIGRATION_AUDIT.md). Estado: **CONDICIONADA**, no lista para producción.

## 17. Correcciones SQL

Las tres palabras pegadas denunciadas no estaban en esta copia. Se corrigen hallazgos reales: search_path de funciones privilegiadas, dependencia del esquema de pgcrypto, permisos por defecto, validación NULL/fechas/estado de mercado, reserva de plazas, edición de pujas liquidadas, constraints económicos y enlaces entre temporadas/ligas. Se añaden índices y triggers de coherencia. Cada hallazgo y su ubicación están documentados en el informe aislado.

## 18. Resultado de validación SQL

pglast 8.7, instalado en entorno temporal: 153 sentencias, 69 tablas, 107 referencias FK, siete funciones, tres cuerpos PLpgSQL y siete bloques DO; también se analiza el SQL dinámico generado. Sin errores de gramática ni referencias de tabla desconocidas/adelantadas. Evidencia: `validation/v02/supabase-static.json`.

No había un ejecutable de servidor `postgres` disponible. No se aplicó la migración: faltan pruebas de resolución real, RLS con roles, triggers y carreras sobre dos conexiones. Las herramientas cliente `psql/pg_ctl/initdb` no se confunden con un servidor ejecutado. La migración es inicial para una base nueva, no un parche para una base Supabase ya instalada.

## 19. Pruebas y capturas

Estado inicial comprobado: **69 pruebas unitarias y 21 de navegador aprobadas**, con un archivo histórico de captura omitido como ya estaba configurado.

Los comandos `npm test`, `npm run check`, `npm run lint` y `npm run build` se ejecutan sobre la implementación actual. Los registros incluyen su resultado y la batería completa de navegador; la validación estática de SQL se conserva por separado.

| Comprobación final | Resultado |
|---|---|
| `npm test` | 82/82 aprobadas |
| `npm run test:e2e` | 29 aprobadas; una captura histórica omitida, igual que en la base |
| `npm run check` | Sin errores |
| `npm run lint` | Sin errores |
| `npm run build` | Compilación y PWA generadas |
| Revisión visual adicional | 24 capturas/comprobaciones, sin desbordamientos, imágenes rotas ni errores JavaScript |
| Análisis SQL | 153 sentencias analizadas; ejecución en PostgreSQL pendiente |

Estado final y comandos: ver registros en `docs/validation/v02`. Se conservan las pruebas anteriores y se añaden 13 unitarias de negocio/persistencia y ocho de navegador para avisos entre sesiones, privacidad, selectores táctiles/teclado/portal, devolución y volver, chat entre presidentes, temporización/reloj/cobro único, valores de investigación y navegación con borrador. La cobertura previa mantiene foto/fallback, mapa toque frente a arrastre, pellizco, Safari/Android, PWA offline, economía, jornada, onboarding, contratos y todas las rutas.

Revisión visual adicional a 390×844, 360×800, 430×932 y columna vertical en escritorio 1440×1000. Galería, capturas funcionales y resultados de desbordamientos/imágenes/JavaScript en `screenshots/v02`.

## 20. Regresiones detectadas y corregidas

- La prueba antigua esperaba recompensa instantánea: conserva la comprobación de persistencia y bloqueo, ahora tras finalizar y recoger realmente.
- `selectOption`/`toHaveValue` nativos dejan de representar el control: pruebas adaptadas a combobox/opciones y selección visible, manteniendo teclado y persistencia.
- Los contadores alteraban el nombre accesible de un departamento: etiqueta estable para el acceso del mapa.
- Un aviso de lectura silencioso podía borrar el toast de una operación: la lectura ya no elimina ese mensaje ni bloquea controles como una compra.
- El margen transparente del atlas colocaba avisos demasiado altos: anclaje con límites medidos del sprite.
- Regalo de satisfacción/suerte y ampliación de techo se confundían con un porcentaje permanente en la explicación: unidades y valor actual corregidos.
- Se corrigieron expectativas de QA que suponían importes abreviados bajo un millón; el juego muestra los importes completos correctamente.
- Un reinicio del servidor de desarrollo durante una primera batería intermedia interrumpió el registro. La validación final se realiza con los fuentes estables y verifica explícitamente la respuesta de registro.

## 21. Parcial y pendiente

- **Fotografías:** integración y fallback implementados; ampliación de 383 pendientes condicionada a licencias/recursos. No hay permiso demostrado para FútbolFantasy.
- **Supabase:** revisión estática y correcciones implementadas; ejecución real/RLS/concurrencia pendientes. El backend normalizado remoto y su conexión al juego continúan fuera del alcance de esta auditoría.
- **Investigación:** personalización avanzada y equipaciones permanecen identificadas como pendientes. El editor básico existente funciona. No se presenta el acceso a equipaciones como terminado.
- **Datos reales:** se identifica honestamente la demostración; no se ha añadido un proveedor de resultados deportivos reales.
- **Borradores:** bloqueo completo dentro de navegación SPA; el navegador no permite sustituir un cierre/recarga forzados por un modal de la aplicación.

## 22. Decisiones autónomas

1. Reutilizar JSON/SQLite/SSE para lecturas y preferencias: mantiene atomicidad, usuarios y sincronización sin infraestructura paralela.
2. IDs por acontecimiento y lecturas de IDs concretos: evita avisos repetidos por refetch y consumir noticias concurrentes.
3. Propuestas deterministas por liga/día y rareza ponderada: recargar no cambia el catálogo ni permite buscar una legendaria; la oferta activa se guarda como copia para continuar entre días/versiones.
4. Cobro manual y bloqueo hasta recoger: hace explícita la recompensa y evita dos actividades simultáneas.
5. Mantener consecuencias de inactividad y sustituir solo la entrega instantánea: conserva reglas ajenas al cambio solicitado.
6. Terreno SVG nativo con sprites existentes: aprovecha el arte y la cámara, permite evolución ambiental sin descargas ni motor 3D.
7. Popup en portal y router con bloqueo real: resuelve recortes de modales y navegación con borradores sin confirmaciones nativas.
8. Preferencia de privacidad en backend: además de recargar, se conserva entre dispositivos del mismo usuario.
9. No conectar efectos inventados para «arreglar» descripciones: se explica el motor y se señalan las dos funciones avanzadas pendientes.
10. Commons como alternativa autorizada a FútbolFantasy: se añade un retrato verificable conservando el resto de avatares y todos los datos deportivos.
11. Auditoría SQL sin ejecución remota y con parser temporal: cumple el aislamiento y distingue gramática de funcionamiento real.
12. Todas las instancias de QA usan bases temporales. Las capturas del antes se generan desde una copia del commit inicial, sin revertir el proyecto actual ni tocar partidas del usuario.
