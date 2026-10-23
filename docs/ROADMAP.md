# Estado de implementación

Las doce fases del encargo se siguieron de manera incremental. «Local» significa que el sistema ejecuta reglas en el servidor de este repositorio; no significa únicamente una pantalla.

| Fase             | Entrega local                                                                    | Trabajo restante                                                                                            |
| ---------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1. Base          | React/TS/Vite, servidor, SQLite, manifest/SW, scripts y migración SQL            | Adaptador PostgreSQL completo y despliegue externo                                                          |
| 2. Diseño        | Sistema móvil vertical, navegación, mapa original y edificios por nivel          | Mayor variedad de fachadas y animaciones de celebración                                                     |
| 3. Usuarios      | Registro/acceso, hash, sesiones, ligas, invitación, seis demos                   | Verificar Supabase Auth y flujo de recuperación; caducidad/rotación de invitaciones locales                 |
| 4. Fútbol        | 20 clubes, 500 futbolistas, mocks, calendario, fichas, informes y rankings       | Feed autorizado, plantillas oficiales completas y correcciones deportivas                                   |
| 5. Economía      | Siete recursos, reservas, libro mayor y cobros transaccionales                   | Ayuda limitada a rezagados y configuraciones administrativas por temporada                                  |
| 6. Mercado       | Draft, ofertas, aceptación, ventas, negociación, intercambio, cesión y cláusulas | Oferta excepcional por suerte, observatorio de pujas más completo                                           |
| 7. Deporte       | Once, formaciones, banquillo, manuales, calidad, salarios y felicidad            | Reglas completas para anulaciones/aplazados con feeds reales; informe de evolución de atributos por jornada |
| 8. Ciudad        | 15 espacios, 12 instalaciones, niveles, obras, cancelación y colas               | Efectos propios de cada nivel de todos los edificios secundarios                                            |
| 9. Investigación | 49 nodos, 3 árboles, requisitos, niveles, costes y efectos                       | Dibujar todas las conexiones cruzadas entre ramas                                                           |
| 10. Gestión      | Patrocinio, conciertos, tienda, decisiones, préstamos y sátira                   | Objetivos adicionales de sponsor, catálogo comercial más profundo, personalización completa                 |
| 11. Social       | Chat, periódico, eventos, entrenadores, museos y archivo                         | Rankings globales de evento, más logros específicos y notificaciones leídas/no leídas                       |
| 12. QA           | Pruebas de dominio, SQLite, navegador, build y simulación                        | PostgreSQL/RLS real, carga, teléfonos físicos, Safari/WebKit y auditoría externa                            |

## Siguiente incremento concreto

1. Ejecutar y corregir la migración en un Supabase nuevo de pruebas, probar políticas entre dos ligas y cubrir las lecturas de detalle todavía cerradas.
2. Introducir un puerto de repositorio asíncrono para PostgreSQL y hacer que todas las operaciones usen ese adaptador, con control de concurrencia e idempotencia equivalentes a SQLite.
3. Trasladar reconciliación a un trabajador desplegable con tareas programadas, logs y reintentos duraderos. Integrar Realtime nativo sin divulgar ofertas secretas.
4. Completar integraciones deportivas autorizadas, versionado por campo y correcciones de resultados liquidados.
5. Validar el balance con agentes que negocien y construyan; probar en dispositivos físicos.

No se presentan estos pasos como una mera falta de credenciales: parte requiere desarrollo adicional. Las claves externas bloquean la verificación remota, pero no explican por sí solas las partes pendientes del adaptador.
