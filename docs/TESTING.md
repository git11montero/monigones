# Verificación realizada

Fecha: **23 de octubre de 2026**. Entorno: macOS, Node 22.22.2, npm 10.9.7. Las pruebas remotas y en teléfonos físicos no se han ejecutado.

## Resultado final

| Comprobación                                          | Resultado                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run check` / TypeScript estricto                 | Correcto                                                           |
| `npm run lint` / ESLint                               | Correcto, sin advertencias de lint                                 |
| `npm test` / Vitest                                   | **58 correctas**, 3 archivos                                       |
| `npm run build`                                       | Correcto; Vite y service worker generados                          |
| `npm run test:e2e` / Chromium                         | **9 correctas**, 47,6 segundos en la ejecución completa registrada |
| `npm run simulate`                                    | 3 escenarios × 38 jornadas, sin violaciones detectadas             |
| `npm run sports:validate -- data/import-example.json` | Catálogo válido                                                    |
| `npm run catalogs`                                    | JSON y seed SQL generados desde configuración común                |

Las duraciones son observaciones de esta máquina, no objetivos garantizados. Vite muestra avisos de anotaciones de dependencias Zod que elimina al compilar; Node 22 muestra su aviso experimental de SQLite. No invalidan los comandos completados.

## Cobertura del motor y persistencia

58 casos cubren: mercado a las 06:00, los dos cambios de horario y el ciclo de actividades antes de las seis en un día de 25 horas; fórmulas de rechazo y atractivo; reserva, modificación y retirada de ofertas; salarios hasta 10 %; aceptación/rechazo; propiedad exclusiva y ofertas rivales secretas; usuarios ajenos; venta al 85 %; VM congelado; reducción salarial; saldo insuficiente y negativo; puntos negativos, penalización por hueco y límites de bonus; suplente pendiente de partido; dos ausentes y uso único de suplente; cambio manual válido y rechazado; infelicidad cero; repetición de liquidación; colas, cancelación, sede y límites de estadio; investigación única y grafo sin ciclos; cláusula antes de fecha o con blindaje; recompensas diarias y de evento repetidas; préstamos y palancas; patrocinio y conciertos; museo y reinicio; plazas reservadas por cesión; intercambios; persistencia tras reinicio; recibos de idempotencia; rollback; pujas concurrentes; controles administrativos; cuentas/sesiones/ligas; subasta del último segundo; proveedores e importación; rollback del lote deportivo y permisos.

La concurrencia se prueba con operaciones casi simultáneas contra el mismo Store y SQLite, no con un clúster distribuido. Las transacciones locales son síncronas y serializadas. No se afirma que todos los caminos de cada regla tengan cobertura completa.

## Recorridos de navegador

1. Acceso demo, ciudad con quince accesos, navegación y ausencia de desbordamiento horizontal.
2. Puja secreta, reserva, recarga persistente y retirada.
3. Actividad diaria y bloqueo de repetición tras recargar.
4. Construcción, avance de servidor y nivel actualizado.
5. Alineación, cierre de jornada e informe económico/deportivo.
6. Chat entre dos contextos de presidente y filtrado de estado privado.
7. Columna de hasta 460 px en escritorio de 1440 px y carga de diecisiete paneles adicionales.
8. Pérdida de red, bloqueo de botones y recuperación de conexión.
9. Build de producción: manifest standalone y portrait, iconos disponibles, service worker controlando la página, precache no vacío, recarga completamente offline y retorno online.

La novena prueba detectó un conflicto de revisiones del SVG en el precache: se corrigió eliminando el alta duplicada y distinguiendo assets con hash. La carga del mapa también reveló dos rutas SVG mal separadas en la cúpula de investigación; se corrigieron. Se mantiene la prueba offline como regresión.

Los servidores de QA usan 5174/3101/3102 y SQLite temporal. Las capturas se guardan en `docs/screenshots/ciudad-mobile.png`, `ciudad-desktop.png` e `informe-mobile.png`; el informe HTML y trazas se generan en directorios ignorados.

## Simulación

La versión final del catálogo produce estos saldos medios al terminar 38 jornadas:

| Escenario            | Saldo medio final | Incidencias detectadas |
| -------------------- | ----------------- | ---------------------- |
| Base                 | 150.858.122 €     | 0                      |
| Actividades sociales | 150.596.338 €     | 0                      |
| Primeras inversiones | 149.229.778 €     | 0                      |

El resultado completo en céntimos está en `simulation-results.json`. No incluye agentes expertos de mercado, máximo desarrollo de ciudad ni búsqueda adversaria exhaustiva de arbitrajes. Véase BALANCING.

## Implementado sin verificación externa

- Puente de Supabase Auth: falta un proyecto con credenciales para probar registro, correo y JWT reales.
- Migración PostgreSQL, RLS y RPC: no hay instancia de PostgreSQL disponible. No se declaran validadas con un análisis estático del archivo.
- Proxy de Pages y despliegue HTTPS: no publicados ni probados en Cloudflare.
- Instalación física Android/iOS, WebKit/Safari, pausado/recuperación del sistema operativo y rendimiento en móviles de gama media.
- Algunas rutas positivas de módulos avanzados, todas las combinaciones de cesiones/cambios y todas las pantallas a 320 px todavía no tienen prueba e2e propia.

El listado de 58 + 9 no equivale a afirmar que todos los casos del encargo se hayan completado. Los aplazamientos/anulaciones y correcciones posteriores de datos reales siguen pendientes de desarrollo.
