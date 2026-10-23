> Documento de la entrega inicial v0.1. Para el rediseño MONIGONES consulta [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md), [BUILDING_ASSETS.md](BUILDING_ASSETS.md) y [SPORTS_ASSETS.md](SPORTS_ASSETS.md).

# Entrega de CROWN XI

**23 de octubre de 2026 · versión 0.1.0**

Se entrega un juego local jugable, persistente y compartido entre navegadores, con un motor de reglas y una interfaz PWA móvil. **No se entrega todavía una edición completa de producción alojada en Supabase**. El alcance es una implementación amplia con servicios locales reales y un proveedor deportivo simulado, con límites y trabajo restante identificados.

## 1. Resumen del juego desarrollado

Cada presidente desarrolla un club fantasy en una liga privada. Puede formar plantilla, negociar, preparar la convocatoria y disputar jornadas simuladas mientras invierte en ciudad, instalaciones e investigación. Actividades, contratos comerciales, decisiones institucionales, eventos y museo conectan la progresión. Se puede jugar sin ninguna credencial externa.

## 2. Arquitectura implementada

Presentación React; reglas y modelos internos compartidos en TypeScript; API autoritativa Node; repositorio SQLite transaccional; SSE para cambios entre usuarios; proveedores deportivos independientes. El navegador solo propone acciones y recibe resultados filtrados. El reloj y los sorteos económicos se resuelven en servidor. Detalle en ARCHITECTURE.

## 3. Tecnologías utilizadas

React 19, TypeScript 5.9, Vite 7, React Router, TanStack Query, Lucide, SVG/CSS originales, vite-plugin-pwa/Workbox, Node 22, SQLite, Zod, HMAC-SHA-256 de Noble, Vitest, Playwright, ESLint y Prettier. Supabase JS se usa en el puente de autenticación opcional. Las versiones resueltas exactas están en `package-lock.json`. CSS propio y animaciones ligeras sustituyen Tailwind y un motor isométrico pesado; no se presenta una librería instalada como un sistema desarrollado.

## 4. Pantallas completadas

27 rutas de juego con paneles internos: ciudad, edificios, investigación, mercado, ficha, equipo, liga, jornada/informe, museo, archivo, finanzas, perfil, ajustes/admin, actividades, patrocinio, conciertos, instituciones, cantera, entrenamiento, afición, bonus, entrenadores, periódico, chat, eventos, draft y negociaciones. Acceso/registro y creación/invitación de liga están integrados antes del juego. Algunas de las 47 pantallas propuestas se han consolidado en pestañas o paneles de una misma ruta; no se afirman 47 rutas independientes.

La interfaz mantiene una columna de hasta 460 px en escritorio y navegación táctil inferior. Los datos proceden del motor, no de tablas de presentación fijas.

## 5. Edificios desarrollados

Quince espacios: sede, estadio, oficinas, investigación, marketing, cantera, dirección, entrenamiento, tienda, finanzas, afición, instituciones, prensa, museo y competición. Trece admiten niveles 1–5. Oficinas usa módulos; competición es un espacio gratuito. El mapa tiene elementos independientes con estado y aspecto por nivel.

## 6. Instalaciones y niveles

Doce instalaciones del estadio, con límites de sede/estadio, costes, plazos y requisitos. Vestuarios amplía hasta 30 plazas; banquillo respeta los ocho estados especificados; césped abre cinco formaciones; LED/aspersores reducen sus gastos; focos mejoran conciertos; videomarcador abre publicidad y comodidad; gradas/VIP/cubierta/seguridad/servicios afectan capacidad o asistencia. Los costes canónicos están en `shared/config.ts`, exportados a JSON y SQL.

## 7. Investigación y dependencias

49 nodos en exactamente tres árboles: 16 Finanzas, 18 Competición y 15 Relaciones; 61 niveles investigables. Hay tres ramas por árbol, dependencias y uniones de ramas, requisitos de centro y una cola única. Las pruebas comprueban el grafo y la exclusión de trabajos duplicados. Las conexiones cruzadas se indican en requisitos; su dibujo completo sobre el grafo sigue pendiente.

## 8. Reglas económicas y deportivas

Dinero en céntimos y puntos en centésimas; reservas, libro mayor, probabilidades y atractivo solicitados; costes de convocatoria congelados; salarios por convocatoria; felicidad y abandono al 85 %; venta mejorable; plantilla y contratos; convocatoria automática; suplencias deterministas; cambios manuales; penalización de huecos; calidad de casillas y techo de bonus; taquilla, mantenimiento, TV, tienda, préstamos, conciertos y patrocinio. Construcción, premios y liquidación usan marcadores o estados de aplicación única.

## 9. Sistemas multijugador

Usuarios, contraseñas locales con scrypt, cookies HttpOnly, sesiones revocables, una liga activa por cuenta, invitación privada y seis presidentes demo. El mismo servidor atiende ventanas o equipos conectados, serializa transacciones y envía cambios por SSE. Hay pruebas de chat entre dos contextos, pujas simultáneas y secreto de ofertas. No es una emulación de varios usuarios aislada en localStorage. No existe todavía Realtime nativo Supabase ni soporte distribuido de varios servidores.

## 10. Datos de prueba

Una liga y seis clubes con doce futbolistas y recursos iniciales; catálogo de veinte clubes, 500 jugadores, 390 identidades con fuente y 110 ficticias; mercado diario; draft para ligas nuevas; jornadas y encuentros; 15 edificios, 12 instalaciones, 49 tecnologías; doce narrativas diarias, seis patrocinadores ficticios, doce artistas como metadatos, seis acciones institucionales y seis tipos de eventos. Noticias y chat demo están identificados como parte de la partida.

## 11. APIs y conectores

`SportsProvider` abarca las operaciones deportivas del encargo. Mock implementado; importador JSON/CSV validado con CLI y carga administrativa; contrato abstracto para proveedor externo. Las importaciones reales requieren fuente y no reemplazan contratos activos. No hay scraping privado. Falta integrar un feed autorizado, su reconciliación completa y reintentos de sincronización externa.

## 12. Recursos gráficos

Escudo e iconos PWA originales, mapa, caminos, árboles, edificios paramétricos, jugadores estilizados, entrenadores, camiseta, carteles y cabecera/ilustración editorial. Iconografía Lucide con licencia de la dependencia. Inventario en ASSETS. No se descargaron fotos, logos ni música de terceros. El arte es coherente y funcional; no todos los edificios secundarios tienen todavía una fachada tan diferenciada como estadio, sede e investigación.

## 13. Ejecutar

```sh
npm ci
npm run dev
```

Abrir http://localhost:5173 y entrar a la demostración. Para una liga nueva, registrar cuenta y fundar club. Para varios presidentes, usar perfiles de navegador distintos. El administrador demo puede acelerar el tiempo en Mi club → Ajustes. La partida se conserva en `data/crown.sqlite`.

## 14. Desplegar

`npm run build` genera `dist`. `npm run start` sirve frontend y API Node desde el mismo origen. Se incluyen cabeceras, rutas SPA y proxy opcional de Cloudflare Pages. DEPLOYMENT explica cada variable y paso. El frontend estático puede alojarse en Pages, pero el juego requiere un backend y disco duradero. La ruta integral gratuita con PostgreSQL/Supabase todavía necesita desarrollo del adaptador y verificación; no se afirma que subir `dist` lo resuelva.

## 15. Instalar Android/iOS

En HTTPS, Android → menú → Instalar; iPhone → Safari → Compartir → Añadir a pantalla de inicio. Se generaron manifest, iconos 192/512, orientación y service worker. La carga offline de producción se ha probado en Chromium. No se ha probado físicamente la instalación en esos sistemas operativos ni Safari.

## 16. Pruebas realizadas

58 pruebas unitarias/integración y 9 e2e correctas; TypeScript, ESLint y build correctos. Tres simulaciones de 38 jornadas terminadas sin violaciones de enteros ni propiedad exclusiva detectadas. Pruebas de VM congelado, salarios, horario de verano/invierno, reservas, concurrentes, suplencias, contratos, colas, reset e idempotencia. El test PWA reproduce y verifica la recarga completamente offline, después de corregir un conflicto de precache. Resultados, cobertura y límites en TESTING.

## 17. Limitaciones reales

Persistencia local por agregado; único proceso de servidor; una página de datos por lectura, todavía sin paginación de toda la temporada; algunas mejoras secundarias comparten arquitectura y carecen de efectos exclusivos por cada nivel; balance preliminar; estadística e informes de recursos simplificados; sin corrección de resultados liquidados ni gestión completa de partidos anulados/aplazados; sin recuperación de contraseña local; invitaciones locales sin expiración/rotación. No se considera una edición competitiva de producción terminada.

## 18. Servicios o credenciales pendientes

Proyecto Supabase de pruebas, credenciales públicas de Auth, validación del SQL/RLS y un runtime con persistencia duradera; origen HTTPS de alojamiento; proveedor deportivo autorizado y medios fotográficos/escudos con permisos si se quieren usar. No se solicitan servicios obligatorios de pago para probar localmente. No se han modificado cuentas ni entornos remotos.

## 19. Funcionalidades aún no terminadas

El adaptador PostgreSQL completo y sus operaciones/vistas, Realtime y cron nativos; sincronización deportiva autorizada y correcciones; personalización completa de escudos/equipaciones; objetivos adicionales de patrocinio; ayuda limitada a rezagados; ofertas excepcionales de mercado; rankings globales de evento; notificaciones leídas/no leídas; más logros específicos; mejores conexiones gráficas del árbol; reglas de aplazamiento/anulación y pruebas en teléfonos físicos. ROADMAP prioriza estos pasos y distingue implementación de credenciales.

## 20. Decisiones autónomas

[DECISIONS.md](DECISIONS.md) contiene la lista numerada de **36 decisiones**, cada una con su motivo: autoridad local, persistencia, concurrencia, tecnología, arte, columna móvil, demo, datos, precisión, reservas, desempates, sorteos, horario, suplencias, transferencias, progresión, cantera, comercio, sátira, compensación, eventos, periódico, comunicación, offline, herramientas, Supabase y despliegue.

## Estados expresos de entrega

| Estado                                        | Alcance                                                                                                                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementado y probado localmente**         | Motor de economía y deporte cubierto por 58 casos; persistencia, sesiones y ligas; ciudad/mercado/equipo e interacciones del e2e; chat compartido; PWA y recarga offline; compilación y simulaciones |
| **Implementado, no verificado completamente** | Algunas rutas positivas de módulos avanzados y todas sus combinaciones; puente Auth real; SQL/RLS/RPC; proxy Pages; instalación en sistemas operativos reales                                        |
| **Simulado y etiquetado**                     | Calendario, partidos, estadísticas, puntos, VM y estados; futbolistas ficticios; dinero y decisiones del universo del videojuego                                                                     |
| **Pendiente de integración externa**          | Supabase Auth real, feed deportivo autorizado, alojamiento HTTPS y medios autorizados                                                                                                                |
| **Pendiente de desarrollo**                   | Adaptador normalizado completo, trabajadores/Realtime Supabase y los sistemas secundarios enumerados en el apartado 19                                                                               |

La presencia de una pantalla, una tabla SQL o una interfaz abstracta no se cuenta como integración remota terminada.
