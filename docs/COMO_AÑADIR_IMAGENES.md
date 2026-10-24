# Cómo añadir imágenes a Monigones v0.3

No necesitas programar para cambiar una imagen. El juego ya incluye el archivo de cada uno de sus 500 futbolistas y 20 clubes.

## 1. Encuentra el archivo

Abre `public/assets/futbol/`:

- `jugadores/`: una imagen por futbolista.
- `escudos/`: un escudo por club real.
- `fallback/`: las dos imágenes genéricas usadas cuando falla un archivo.

Busca el nombre exacto en [INVENTARIO_IMAGENES.csv](INVENTARIO_IMAGENES.csv), que puedes abrir con Excel o Numbers. La columna **Ruta** empieza por `/assets`; en tu ordenador debes anteponer `public`.

Ejemplos:

| Persona o club | Archivo que debes sustituir                                |
| -------------- | ---------------------------------------------------------- |
| Mbappé         | `public/assets/futbol/jugadores/realmadrid-mbappe.png`     |
| Vinicius       | `public/assets/futbol/jugadores/realmadrid-vinicius.png`   |
| Pedri          | `public/assets/futbol/jugadores/barcelona-pedri.png`       |
| Lamine Yamal   | `public/assets/futbol/jugadores/barcelona-lamineyamal.png` |
| Isco           | `public/assets/futbol/jugadores/betis-isco.png`            |
| Real Madrid    | `public/assets/futbol/escudos/realmadrid.png`              |
| Betis          | `public/assets/futbol/escudos/betis.png`                   |

Los escudos son de los clubes reales del catálogo. El emblema personal del club fantasy mantiene su editor y su identidad independiente.

## 2. Prepara tu PNG

Recomendamos **512 × 512 píxeles** para jugadores y **256 × 256** para escudos. El validador admite de 64 a 4096 píxeles por lado. Exporta realmente como PNG: cambiar la extensión de un JPG no lo convierte en PNG.

Puedes utilizar transparencia. Centra el rostro y el torso, deja algo de margen y evita estirar la fotografía para hacerla cuadrada: amplía el lienzo con transparencia. El juego conserva la proporción y muestra la imagen completa dentro de la tarjeta. No añadas texto diminuto.

## 3. Sustituye y comprueba

1. Guarda una copia del archivo actual si quieres conservarlo.
2. Coloca tu PNG en la carpeta, **con el mismo nombre exacto**, sustituyendo el anterior.
3. Mantén el juego abierto y conectado al servidor. En unos **5 segundos**, las pantallas abiertas detectan el contenido nuevo; también puedes recargar.
4. Comprueba Plantilla, Mercado o la ficha del futbolista. Todas comparten el mismo componente y la misma ruta.

No cambies TypeScript, JSON, base de datos, URLs ni componentes para esta operación. No ejecutes una importación ni reconstruyas el frontend por cada fotografía. Los nombres siempre están en minúsculas, sin tildes ni espacios y terminan en `.png`; algunos apellidos compuestos se unen en el identificador de recurso. Usa el inventario en lugar de adivinar.

El servidor local publica los archivos de `public/assets/futbol` incluso en producción. Si alojas el juego en otro ordenador o servidor, sustituye allí los archivos; cambiar una copia local no modifica un alojamiento remoto. El directorio debe ser persistente en un despliegue por contenedores. Un hosting estático aislado no ofrece la detección automática del backend.

## 4. Si no aparece

- Confirma carpeta, nombre, minúsculas y extensión. Revisa que el sistema no lo haya guardado como `.png.png`.
- Comprueba que el PNG se abre en Vista Previa y que no está truncado.
- Comprueba que el servidor está arrancado y tienes conexión. La PWA sin conexión conserva la última imagen visitada, no puede recibir un archivo que todavía no ha descargado.
- Vuelve a abrir la ficha o recarga. La URL incorpora automáticamente una versión calculada a partir del contenido para evitar la caché antigua.
- Ejecuta `npm run images:validate` desde la raíz del proyecto para localizar archivos ausentes, corruptos o con dimensiones incorrectas. Requiere Node 22.22+ e ImageMagick (`magick`). El comando actualiza el inventario y el informe de validación, sin sobrescribir tus PNG.

Si falta o falla una imagen, se muestra la silueta o el escudo genérico de `fallback/`. No se sustituye por la fotografía de otra persona.

## 5. Si cambia una plantilla real

Esta operación sí es una actualización de datos deportivos, distinta de sustituir una foto:

1. Conserva el **ID del futbolista** al importar la nueva plantilla y actualiza su `realClubId` por el procedimiento de datos deportivos del proyecto.
2. El recurso permanece estable y cambia el prefijo del archivo. Si Mbappé pasase realmente al Betis, la ruta sería `betis-mbappe.png`.
3. Coloca la fotografía correcta con ese nuevo nombre. Mientras falte, se mostrará el fallback. El servidor reconoce ese nombre y su versión automáticamente.
4. Al actualizar el catálogo fuente de la temporada, ejecuta `npm run images:prepare` para completar archivos ausentes y regenerar el catálogo y el CSV. Los PNG existentes se conservan. Revisa los cambios antes de incorporarlos.

Una compra o cesión **dentro del fantasy** no cambia `realClubId`, el identificador de recurso ni la fotografía. Los nombres repetidos reciben un sufijo estable basado en su ID. El catálogo central está en `shared/football-assets.json`; no debe editarse para un simple cambio de imagen.

## 6. Qué incluye esta entrega

522 PNG físicos: 500 jugadores, 20 escudos y 2 fallbacks. Hay 493 siluetas de jugador, 7 fotografías previamente autorizadas y 20 escudos genéricos. Las 110 identidades ficticias siguen teniendo siluetas genéricas. No se afirma cobertura fotográfica completa ni escudos oficiales.

Utiliza imágenes que tengas derecho a distribuir. El juego no busca ni descarga fotografías de terceros. Un archivo nuevo se identifica como **aportado por el usuario**, sin inventar una licencia ni darlo automáticamente por fotografía real. Las siete fotos autorizadas conservan sus créditos mientras sus bytes coincidan con los autorizados.
