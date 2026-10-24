# Fotografías de jugadores · auditoría v0.2 · 23/10/2026

**Integración parcial por cobertura, sin imágenes de permiso desconocido en el juego.** Se conserva el catálogo deportivo: 500 IDs, nombres, clubes, posiciones, VM, puntuaciones y contratos sin modificación por esta tarea.

## Cobertura comprobada

| Medida | Resultado |
|---|---:|
| Futbolistas del catálogo | 500 |
| Identidades deportivas con fuente | 390 |
| Identidades creadas para la partida | 110 |
| Fotografías reales con licencia registradas y distribuidas | 7 |
| Ya existentes antes de v0.2 | 6 |
| Incorporadas en esta entrega | 1: Pedri |
| Imágenes sin autorización distribuidas | 0 |
| Candidatas de FútbolFantasy descartadas por falta de licencia de reutilización | 1 referencia concreta: Buba Sangaré |
| Futbolistas reales sin fotografía autorizada integrada | 383 |
| Avatares originales conservados | 493: 383 + 110 |
| Errores de identidad detectados/corregidos | 0 / 0 |
| Fotografías declaradas definitivamente «no encontradas» | 0: no se ha hecho una búsqueda exhaustiva de las 383 pendientes |

Cobertura: 7/390 = **1,79 %** de identidades reales; 7/500 = **1,4 %** del catálogo total. La falta de una licencia comprobada se clasifica como pendiente, no como prueba de que una foto no exista. Los contadores son reproducibles con `npm run sports:assets` y quedan en `data/sports-asset-catalog.json`.

## FútbolFantasy: acceso y condiciones

Se intentó abrir la portada, la ficha `https://www.futbolfantasy.com/jugadores/buba-sangare/laliga-26-27` y la referencia de imagen proporcionada. El navegador de consulta devolvió 502/acceso no disponible para esas direcciones. El aviso legal se obtuvo a través del buscador y se contrastó mediante una petición HTTP directa al HTML público de [Aviso Legal](https://www.futbolfantasy.com/aviso-legal), con éxito. No se realizó extracción masiva, se eludieron controles ni se descargó la fotografía de la referencia.

El apartado de propiedad intelectual incluye fotografías e imágenes entre los contenidos cuyos derechos de explotación no se ceden por navegar por el sitio. No se encontró una licencia para redistribuirlas dentro del juego. Por tanto, **no se ha incorporado ninguna foto de FútbolFantasy**. Hace falta permiso adecuado antes de usar esa fuente.

El jugador de la referencia existe en el catálogo como **`elche-4`, Buba Sangaré, Elche, temporada 2026/27**. Se contrastó la identidad y temporada con [su ficha de LaLiga](https://www.laliga.com/es-GB/jugador/buba-sangare). El ID `12878` de la URL suministrada no se considera un identificador verificado por el mero parecido del nombre. Su avatar se mantiene.

## Alternativa autorizada incorporada

**Pedri**, `barcelona-10`, FC Barcelona, temporada del catálogo 2026/27. Identidad completa contrastada como **Pedro González López** en [el archivo del FC Barcelona](https://players.fcbarcelona.com/es/jugador/2773-pedri-pedro-gonzalez-lopez) y su [ficha oficial 2026/27](https://www.fcbarcelona.com/en/football/first-team/players/70486/pedro-gonzalez-lopez). No se cambió el registro del jugador.

Fotografía: [Pedri France v Spain 7.24.26-226.jpg, Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Pedri_France_v_Spain_7.24.26-226.jpg). Autor: **Bryan Berlin / WikiPortraits**. Licencia: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), verificada en la ficha. Es una fotografía con equipación de la selección, no una supuesta sesión oficial del club ni una colaboración comercial. La atribución y el enlace de licencia se presentan en los créditos compartidos.

Se conserva el JPEG original en `assets-source/photos/barcelona-10-pedri.jpg`. Se sirve una copia WebP de **512 × 769**, unos **55 KiB**, en `public/sports/barcelona-10-pedri.webp`. Modificación declarada: conversión y reducción de resolución; copia derivada bajo la misma licencia. El original permanece sin editar. No se utiliza la foto para avalar productos ni se afirma cesión de derechos de imagen personal por la licencia de autor.

Las seis fotografías anteriores y sus licencias permanecen en `shared/builtin-sports-photos.json`: Mbappé, Bellingham, Vinícius, Lamine Yamal, Unai Simón y Laporte. No se atribuyen como nuevas incorporaciones. El catálogo central contiene fuente, autor, licencia/enlace, temporada, identidad, fecha, archivo original y dimensiones.

## Integración y fallos de carga

Todos los accesos reutilizan `PlayerPortrait`/`PlayerAvatar`/`PlayerCard`: mercado, ficha, once, convocatoria, draft y listas de futbolistas. La resolución se realiza por **ID estable**, sin coincidencias aproximadas ni asignación por orden de lista. El club se lee siempre del registro deportivo, no de la camiseta de la foto. Las 110 identidades inventadas nunca reciben un retrato real.

Las imágenes usan dimensiones declaradas, decodificación asíncrona y carga diferida. Un error de red activa el retrato original correspondiente al mismo ID. Los artículos que no están asociados a un jugador no inventan una asociación para mostrar una foto. Los emblemas de clubes siguen siendo originales alternativos; no se han obtenido nuevas licencias para escudos oficiales.

Validaciones: las pruebas existentes comprueban identidad exacta, dimensiones, hashes distintos y fallback; la batería de navegador incorpora Pedri a los seis retratos ya comprobados. La manifestación de licencia debe mantenerse al importar nuevas imágenes mediante el flujo existente; nunca basta con una URL accesible.

## Pendiente

Ampliar la cobertura de las 383 identidades reales mediante fotografías con licencia comprobada o un proveedor autorizado. La búsqueda no está automatizada ni se promete cobertura total. Para FútbolFantasy permanece pendiente obtener permiso de reutilización; el desarrollo de las demás funciones no depende de ello.
