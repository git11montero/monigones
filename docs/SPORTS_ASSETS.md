# Fotografías, emblemas y cobertura

Catálogo central por **ID interno**, identidad, club actual, temporada `2026/27`, IDs externos disponibles, archivo, fuente, autor, licencia, fecha y estado. `sportsAsset(player)` conserva la identidad fotográfica al cambiar el club y obtiene el emblema del `realClubId` actual. No se hacen asociaciones aproximadas por nombre. Las 110 identidades ficticias nunca reciben fotografías de personas reales.

Cobertura verificada al entregar: **6 / 390 fotografías reales (1,54 %)**, **384 pendientes**, **110 retratos ficticios consistentes** y **20 emblemas alternativos originales**. **0 escudos oficiales autorizados**. Se muestran como ALT y su alternativa no se anuncia como escudo oficial. No se ha alcanzado cobertura fotográfica completa.

| ID | Fotografía | Autor | Licencia / fuente |
|---|---|---|---|
| madrid-13 | Kylian Mbappé | Bryan Berlin / WikiPortraits | [CC BY-SA 4.0 · ficha original](https://commons.wikimedia.org/wiki/File:Kylian_Mbappe_-_France_v_Senegal_-_16_June_2026.jpg) |
| madrid-8 | Jude Bellingham | Bryan Berlin / WikiPortraits | [CC BY-SA 4.0 · ficha original](https://commons.wikimedia.org/wiki/File:Jude_Bellingham_England_v_Panama_27_June_26-160.jpg) |
| madrid-14 | Vinícius Júnior | Bryan Berlin / WikiPortraits | [CC BY-SA 4.0 · ficha original](https://commons.wikimedia.org/wiki/File:Vinicius_Junior_Brazil_V_Morocco_13_June_2026-94_(cropped).jpg) |
| barcelona-17 | Lamine Yamal | Biso | [CC BY 4.0 · ficha original](https://commons.wikimedia.org/wiki/File:Lamine_Yamal_in_2025_(cropped).jpg) |
| athletic-0 | Unai Simón | Bryan Berlin / WikiPortraits | [CC BY-SA 4.0 · ficha original](https://commons.wikimedia.org/wiki/File:Unai_Simon_France_v_Spain_7.24.26-066.jpg) |
| athletic-4 | Aymeric Laporte | Lluis Fernandez Salas | [CC BY 2.0 · ficha original](https://commons.wikimedia.org/wiki/File:Aymeric_Laporte(cropped).jpg) |

Verificación: 23-10-2026. Se guardan los JPEG originales sin modificación, incluida su metadata. El recorte para encajar en carta se realiza en la presentación CSS. Algunas fotos muestran selecciones o equipaciones históricas; no representan la equipación del club actual. El crédito y el enlace a la licencia aparecen en la ficha y en `/media`. Las fotos CC BY-SA mantienen esa licencia para sus derivados; no se pretende atribuirlas al juego ni trasladar su licencia al código independiente.

Se consultaron Commons y WikiPortraits, y se descartaron resultados con autoría dudosa, imágenes editoriales de agencias que necesitan contratación y resultados de personas homónimas. En particular, los resultados del político Alex Padilla no se asociaron al portero Álex Padilla. Tampoco se usaron antiguos escudos como si fueran actuales. No se descargó masivamente una web deportiva.

## Herramientas

`npm run sports:assets` genera `data/sports-asset-catalog.json` para los 500 registros, comprueba archivos, cabeceras, dimensiones y duplicados por SHA-256. Las pruebas de navegador comprueban la carga y la alternativa al abortar una foto. La ficha de club se deriva siempre del registro deportivo.

`npm run sports:assets:import -- /ruta/paquete/manifest.json` importa archivos locales de un paquete autorizado. El manifiesto incluye `season` y `photos`, con playerId, identity exacta, clubId, season, file relativo al paquete, source HTTPS, author, license, licenseUrl, verifiedAt, width, height, modified y sha256. Rechaza IDs desconocidos, identidades ficticias, club/temporada incorrectos, duplicados, licencia no admitida, imágenes pequeñas, hash o dimensiones incorrectos y rutas que salen del paquete. Copia los archivos al directorio de importaciones y genera `shared/imported-sports-assets.ts`; hay que volver a generar el catálogo y compilar.

La validación automatizada comprueba la integridad del paquete, no puede demostrar por sí sola que una autorización declarada sea auténtica. La fuente y la licencia deben verificarse antes de preparar el manifiesto. Licencias admitidas: CC0, CC BY 2.0/4.0, CC BY-SA 3.0/4.0. No se admiten NC, ND ni descargas protegidas. El importador no modifica SQLite ni contratos y no realiza búsquedas difusas de identidades.
