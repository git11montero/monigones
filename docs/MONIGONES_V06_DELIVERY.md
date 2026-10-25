# Monigones v0.6 — entrega local

No se ha modificado Supabase remoto, Auth, la liga importada, Vercel remoto ni la partida SQLite del usuario. No se ha desplegado. Versión de paquete: 0.6.0. El código conserva ambos modos: `npm run dev` o el build local con SQLite, y el artefacto online autocontenido de `.vercel/output` para Vercel. Al finalizar se deja `dist/` reconstruido en modo local; reconstruirlo no altera el artefacto prebuilt online.

## Implementado

- Catálogo nuevo de 500 jugadores reales de los veinte clubes 2026/27, nombres oficiales, IDs externos, fuentes y auditoría reproducible. Valores de mercado y puntos siguen siendo del simulador. 360 IDs anteriores conservados; catálogo/recursos históricos archivados y compatibles, sin actualización automática de partidas guardadas.
- Fuente única con los cinco equipos personalizados, Fermín López corregido a FC Barcelona y sexto club reservado vacío. Previsualización sin red/credenciales, validación de identidad, posiciones, duplicados, capacidad, contratos y coste de convocatoria. Reutiliza las RPC transaccionales existentes, hashes, historial de ejecuciones y bloqueos de sobrescritura. No hace falta SQL adicional.
- Veinte escudos WebP 256×256 con PNG compatibles; 500 retratos PNG activos y 140 históricos conservados. Retiradas siete fotos de terceros, copias y créditos públicos correspondientes; procedencia histórica fuera de la interfaz. El PNG de Madrid aportado por el usuario se conserva.
- Canvas sin circulación de actores ni bucle perpetuo. Calidad gráfica aplicada a resolución; iluminación, edificios, obras, cámara, zoom y decoración conservados.
- Geometría común del menú inferior y diálogos basada en viewport visible/zona segura. Gestión común de teclado, formularios de 16px, gestos fuera del mapa y zoom interno conservado.
- Importes españoles completos en todas las llamadas al formateador monetario. Campos económicos con errores precisos y persistentes, límites reales y validación autoritativa. Sin revelar reservas/pujas rivales; tampoco se publica el disponible del comprador al vendedor cuando un acuerdo falla por fondos.
- Ayuda ⓘ centralizada, accesible por teclado y tacto, con límites y ejemplos del motor.
- Oficinas con requisitos y acción dentro de cada uno de sus nueve módulos.
- Entrenamiento con 14 dibujos, bloqueo por césped y consulta sin modificar el once. Once mejoras persistentes con correspondencia por índice, calidades y bonus originales, colores/etiquetas/bordes diferenciados.
- Cabecera con marca, chat, audio y noticias. Panel de chat compartido con periódico/ruta, avisos y borrador por liga/club. No hay otro backend de chat.

## Pruebas reales

| Comprobación | Resultado |
|---|---|
| `npm run check` | TypeScript frontend y grafo NodeNext online aprobados |
| `npm run lint` | ESLint aprobado |
| `npm test` | 203 pruebas unitarias, 14 archivos, aprobadas |
| `npm run test:postgres` | 43 integraciones, 2 archivos, PostgreSQL 17 nuevo y desechable en loopback; todas las migraciones existentes y seed aplicados solo allí |
| Navegador | 49 casos distintos aprobados entre suite completa y reejecuciones de los afectados; 1 histórico omitido; sin fallos pendientes. [Registro de ejecuciones](validation/v06/results.json) |
| `npm run images:validate` | Decodificación PNG/WebP, dimensiones, rutas e inventario aprobados; 0 fotos licenciadas activas y 0 archivos inesperados |
| `npm run build` | Build local y service worker aprobados |
| `npx vercel build --prod` | Build online real de Vercel y comprobación PWA; 50 entradas de precaché |
| Artefacto Vercel bajo Node 24 | 36 comprobaciones HTTP; función copiada fuera del repositorio, ESM nativo y dependencias incluidas; Supabase sustituido por fixture HTTP local |
| Demo incompleta | `--offline-preview` termina con código 1 por A. Santos, sin leer credenciales ni conectarse |

Las integraciones ejercitan usuarios simultáneos, membresías, RLS, permisos, aislamiento entre ligas, idempotencia, recuperación, importador y cambios concurrentes de formación sin duplicar mejoras. La demo completa usada en pruebas sustituye al jugador pendiente **solo en una fixture de pruebas**, sin modificar la fuente real. El cluster desechable emula el esquema Auth mínimo y roles Supabase: no constituye validación remota de Auth/Realtime.

La primera ejecución de navegador detectó selectores ambiguos tras añadir el segundo acceso al mismo chat, una expectativa de URL de fallback sin versión y recargas del servidor mientras se normalizaba el catálogo. Se corrigieron/revalidaron los casos afectados. Una prueba nueva encontró que una regla antigua del compositor mantenía 14px; se corrigió a 16px y se repitieron teclado/chat/gestos. No se ocultan errores de consola ni fallos con capturas genéricas.

Capturas nuevas de 320×568, 375×812, 390×844, 430×932 y 1440×1000: [galería v0.6](screenshots/v06/index.html). Medidas de las cinco rutas principales en [navigation.json](validation/v06/navigation.json). Las galerías históricas se conservan sin reescribir su evidencia con la interfaz nueva.

## Pendiente explícito

1. **A. Santos sin confirmar.** La plantilla real de Porcinos no es importable todavía. No se ha asignado a Antony. Ver [DEMO_FANTASY_TEAMS.md](DEMO_FANTASY_TEAMS.md).
2. No estaban adjuntas las cinco imágenes de las capturas: la correspondencia se basa en el listado textual, la aclaración expresa del usuario y fuentes deportivas. Se explican la normalización de Péter Gulácsi y las cinco discrepancias posicionales en [la auditoría](SPORTS_CATALOG_AUDIT.md).
3. Las cuentas ya asociadas a otra liga no pueden reutilizarse automáticamente en la nueva; se necesitan cuentas de prueba sin membresía. No se han creado ni eliminado cuentas.
4. Pendiente de autorización: publicar frontend/backend y, tras completar/revisar la fuente, cargar la liga nueva. Sin modificaciones remotas ni comprobación de la nueva versión en producción.
5. Safari/iOS y Chrome/Android se prueban con motores/emulación. Instalación física, teclado real, barras dinámicas y gestos reservados de accesibilidad requieren verificación en dispositivos. La aplicación no impide el zoom del sistema o el que el navegador reserve.

## Reproducir y publicar después de revisión

Entorno local: Node 22.22+, dependencias instaladas, ImageMagick para validar imágenes. Para PostgreSQL se necesitan binarios 17+; se crea un cluster temporal y nunca se utiliza `DATABASE_URL` ni una base existente.

```sh
npm ci
npm run check
npm run lint
npm test
MONIGONES_PG_BIN=/ruta/postgresql/bin MONIGONES_PG_SHARE=/ruta/postgresql/share/postgresql npm run test:postgres
npm run images:validate
npm run images:manifest
npm run build
npx playwright test
```

Las variables de build online siguen siendo `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; secretos de servidor, Auth, Realtime y cron mantienen la arquitectura documentada en [ONLINE_SETUP.md](ONLINE_SETUP.md). No se han cambiado variables remotas. Con la configuración local de Vercel ya existente:

```sh
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
```

**Solo después de autorizar la publicación**, para desplegar exactamente el artefacto revisado:

```sh
npx vercel deploy --prebuilt --prod
```

No ejecutar `supabase db push` para esta entrega: no hay migraciones nuevas. Los comandos de creación de la liga distinta, previsualización, confirmación interactiva y verificación están en [DEMO_FANTASY_TEAMS.md](DEMO_FANTASY_TEAMS.md). Las actualizaciones manuales de PNG/WebP se publican con el mismo frontend: [IMAGE_ASSETS_V06.md](IMAGE_ASSETS_V06.md).

## Decisiones autónomas

- Crear una liga distinta y reservar la sexta plaza; no ofrecer una actualización destructiva de la liga jugada.
- Mantener A. Santos como dato pendiente y prohibir cualquier carga incompleta, sin adivinar su identidad.
- Conservar IDs conocidos, recursos históricos y catálogos completos anteriores; no reciclar IDs ficticios.
- Documentar posiciones Fantasy cuando difieren de la clasificación estadística, sin importar puntos/precios de otras plataformas.
- Asignaciones gratuitas y dotación inicial explícita únicamente en la nueva fuente de demo; reglas económicas intactas.
- Mantener PNG de escudos como respaldo y convertir su contenido a WebP lossless; retratos manuales PNG.
- Usar once índices persistentes en Entrenamiento y conservar los bonus actuales; sin migración de formato.
- Unificar chat y diálogo de ayuda; mantener zoom accesible del navegador y documentar el límite físico de la emulación.

Documentos complementarios: [UX_AUDIT_V06.md](UX_AUDIT_V06.md), [TACTICAL_SLOTS.md](TACTICAL_SLOTS.md), [SPORTS_CATALOG_AUDIT.md](SPORTS_CATALOG_AUDIT.md).
