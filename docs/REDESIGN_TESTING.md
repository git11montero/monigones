# Verificación del rediseño

## Reproducir

```sh
npm ci
npx playwright install chromium webkit
npm run sports:assets
npm run check
npm run lint
npm test
npm run build
npm run test:e2e
```

La suite e2e arranca API y Vite en 3101/5174 y una compilación de producción en 3102. Sus bases son `/tmp/crown-e2e-*.sqlite` y `/tmp/crown-pwa-*.sqlite`. Los fixtures verifican esa ruta y actualizan bajo una transacción `BEGIN IMMEDIATE` con espera de bloqueo para convivir con el reloj del servidor. Las capturas y las pruebas no se preparan sobre `data/crown.sqlite`.

La captura histórica `redesign-before.spec.ts` está desactivada en ejecuciones normales: se ejecutó antes del cambio con `AUDIT_BEFORE=1`. No debe volver a sobrescribir las imágenes del diseño anterior. La omisión histórica es intencional, no una prueba funcional pendiente.

## Cobertura funcional

Se conservan las 58 pruebas de dominio/persistencia originales y se añaden once pruebas de cámara, estados de ciudad, recursos gráficos, fotografía, importación y preferencias: **69 pruebas unitarias**. Cubren economía entera en céntimos, convocatorias, reservas, permisos, horario Madrid, obras, dependencias, felicidad, préstamo y deduplicación, además de los sistemas nuevos.

Las nueve pruebas e2e anteriores continúan comprobando demo, ciudad, mercado y salario persistente, actividad diaria, mejora de sede, cierre/informe de jornada, dos presidentes con chat, secreto de ofertas, rutas y columna vertical, pérdida de conexión y PWA de producción con recarga offline.

Las nuevas pruebas comprueban arrastre que no selecciona, zoom por botones/teclado, pellizco con dos dedos mediante CDP, toque en edificio, arquitectura 1/3/5, instalaciones/modales, obra y cambio persistente, normal/partido/normal, cartas y banquillo, estadísticas y liquidación, seis fotografías, error de carga con alternativa, tres árboles y nueve ramas, preferencias y sonidos, movimiento reducido, registro, creación, invitación antes del draft, draft activo, patrocinio y concierto con contratos de servidor, rutas sin desbordamientos, Safari WebKit y Chrome Android emulados.

Se instrumenta `AudioContext.createOscillator` para verificar que se producen voces con efectos activados y no se crean efectos nuevos al silenciarlos. Las preferencias se comprueban tras recarga. Esta prueba no es una grabación de salida de audio.

## Capturas y revisión

`screenshots/redesign/` contiene ciudad 1/3/5, estadios 1/3/5, día normal y partido, obra, instalación, ficha, retrato alternativo, draft, creación/invitación, convocatoria, informe, escritorio y motores móviles. `routes/` cubre 42 destinos concretos incluyendo los quince edificios. `route-coverage.json` deja constancia de destinos e imágenes revisados.

Las capturas esperan título, salida de Suspense, fuentes y decodificación de imágenes y atlas. Se revisaron visualmente acceso, ciudad, estadio, investigación, plantilla, mercado, ficha y jornada; la galería reúne el resto para inspección. La auditoría automatizada detecta imágenes rotas, errores JavaScript y desbordamiento horizontal. No sustituye una revisión humana exhaustiva de cada combinación de estado, permisos y tamaño.

Se comprueba la columna en escritorio de 1440 px, móvil de 320/390 px y contextos iPhone 13 y Pixel 5. WebKit automatizado aproxima el motor de Safari, pero no constituye una prueba en un iPhone físico. No se dispone de una certificación de rendimiento/batería en dispositivos reales.

Los registros finales y su resultado se guardan en `redesign-baseline/final-*` al terminar el pase de validación. La cobertura de recursos deportivos se regenera de los archivos distribuidos, sin afirmar disponibilidad de fotografías o escudos pendientes.

## Resultado final comprobado

`check`, `lint`, `build` y validación de recursos deportivos: correctos. **69/69 pruebas unitarias** y **21/21 pruebas e2e funcionales** correctas en el pase completo final. Una prueba histórica omitida intencionalmente para conservar el antes. Los veinte tipos de captura obligatorios están presentes y el manifiesto contiene **42 destinos concretos**. WebKit y Chromium completan las verificaciones móviles emuladas; el modo PWA supera la recarga offline.

La comprobación visual final adicional de Finanzas, Mi club, periódico y ficha consta en `screenshots/redesign/verification/review.json`: superficies y contraste corregidos, sin errores JavaScript. El artículo abre y cierra con Escape. La galería completa se abre en [screenshots/redesign/index.html](screenshots/redesign/index.html).
