# Recursos de imagen v0.6

Veinte escudos **WebP lossless reales**, 256×256 y fondo transparente cuando el original lo permite. PNG anteriores conservados como compatibilidad. Se respeta el PNG de Real Madrid previamente modificado por el usuario y se deriva su WebP sin sobrescribir ese original.

Los retratos siguen siendo PNG reemplazables manualmente. El catálogo activo contiene 500, y se conservan 140 recursos retirados para partidas históricas; junto a los 20 escudos PNG y 2 fallbacks hay **662 PNG**, además de los 20 WebP. La cifra antigua de 522 correspondía únicamente al catálogo anterior. No se eliminan recursos necesarios para partidas guardadas.

Se han retirado las siete fotos de terceros de `public/sports/` y `assets-source/photos/`, sus siete copias autorizadas se han sustituido por el placeholder original y se ha vaciado el catálogo de fotos activas. Procedencia/licencias históricas en [docs/provenance/retired-photos-v05.json](provenance/retired-photos-v05.json). Sin descargas de imágenes nuevas. La ruta antigua `/media` redirige a Ajustes; desaparecen créditos de fotos retiradas. El antiguo importador automático de fotos devuelve una instrucción de sustitución manual, conservando sus validadores para auditoría.

## Sustituir y publicar

1. Buscar al jugador por ID/nombre en [INVENTARIO_IMAGENES.csv](INVENTARIO_IMAGENES.csv). Sustituir exactamente su PNG (`equipo-recurso.png`) por una imagen propia. Identidad de recurso independiente del propietario Fantasy. Las identidades históricas conservan su ruta anterior.
2. Para un escudo, sustituir su WebP por un WebP válido 256×256. Si se aporta PNG, actualizar también el WebP: `npm run images:prepare -- --refresh-crests` regenera los veinte desde sus PNG. Revisar el diff para no restaurar un PNG antiguo sobre un WebP propio.
3. Validar y construir:

```sh
npm run images:validate
npm run images:manifest
npm run build:online
npx vercel build --prod
npx --yes --package=node@24 node scripts/test-vercel-artifact.mjs
```

4. Revisar y guardar cambios de PNG/WebP, catálogo si cambió y manifiesto. Publicar mediante el flujo Git existente o, tras autorización, `npx vercel deploy --prebuilt --prod` para el artefacto que se acaba de comprobar. Si el artefacto no corresponde al último cambio de imágenes, construirlo de nuevo antes de publicar.

El manifiesto asigna versiones SHA de contenido; todas las pantallas usan el mismo resolver, sin editar componentes. El modo local detecta cambios cada 5 segundos; online consulta el manifiesto estático cada 60 segundos. En Vercel los archivos se publican con el frontend; no se escriben archivos permanentes desde Functions. La PWA conserva su mecanismo de actualización. No hace falta reinstalar para cada PNG.

Fallback de escudo: WebP del club → PNG compatible del mismo club → PNG neutro → SVG neutro incorporado si tampoco carga el último archivo. Retrato: PNG específico → PNG neutro → SVG neutro. Los fallbacks y las versiones se recuperan tras cambiar el manifiesto; no se oculta la imagen ante un fallo.

`images:validate` comprueba firma, descompresión/decodificación completa ImageMagick, dimensiones, colisiones y archivos inesperados. Inventario activo en CSV e informe en `docs/validation/v06/images.json`. Las pruebas de navegador incluyen sustitución manual y funcionamiento PWA; no descargan fotografías.
