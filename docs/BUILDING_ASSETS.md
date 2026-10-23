# Catálogo de edificios y recursos

Arte original creado con la herramienta integrada imagegen. Originales PNG en `assets-source/art/`; entrega WebP en `public/art/`, calidad 90 y alfa conservado. Prompts en `ART_PROMPTS.json`.

[Galería visual de todos los niveles](building-gallery.html) · [Catálogo JSON](../data/building-visual-catalog.json).

| Edificio                                 | Atlas / fila                        | Apariencias usadas              |
| ---------------------------------------- | ----------------------------------- | ------------------------------- |
| Sede central (hq)                        | public/art/core-atlas.webp · 1      | I, II, III, IV y V              |
| Estadio de la Corona (stadium)           | public/art/core-atlas.webp · 2      | I, II, III, IV y V              |
| Oficinas del club (offices)              | public/art/commerce-atlas.webp · 1  | Única; acceso sin nivel general |
| Centro de investigación (research)       | public/art/core-atlas.webp · 3      | I, II, III, IV y V              |
| Departamento de marketing (marketing)    | public/art/training-atlas.webp · 1  | I, II, III, IV y V              |
| Cantera (academy)                        | public/art/training-atlas.webp · 2  | I, II, III, IV y V              |
| Dirección deportiva (sport)              | public/art/commerce-atlas.webp · 2  | I, II, III, IV y V              |
| Centro de entrenamiento (training)       | public/art/training-atlas.webp · 3  | I, II, III, IV y V              |
| Tienda oficial (shop)                    | public/art/commerce-atlas.webp · 3  | I, II, III, IV y V              |
| Centro financiero (finance)              | public/art/relations-atlas.webp · 1 | I, II, III, IV y V              |
| Área de afición (social)                 | public/art/relations-atlas.webp · 2 | I, II, III, IV y V              |
| Relaciones institucionales (institution) | public/art/relations-atlas.webp · 3 | I, II, III, IV y V              |
| Sala de prensa (press)                   | public/art/culture-atlas.webp · 1   | I, II, III, IV y V              |
| Museo del club (museum)                  | public/art/culture-atlas.webp · 2   | I, II, III, IV y V              |
| Sede de competición (competition)        | public/art/culture-atlas.webp · 3   | Única; acceso sin nivel general |

Hay 65 apariencias para los 13 edificios mejorables y dos apariencias fijas. Los cinco atlas contienen 75 dibujos: las variantes adicionales de los dos edificios sin nivel no se exponen como mejoras. Cada columna cambia la arquitectura: anexos, alturas, tejados, cubiertas, fachadas, jardines y equipo. El progreso del estadio va de campo abierto con grada modesta a arena monumental techada con centro abierto.

Los límites reales de alfa se midieron para impedir que aparezcan fragmentos de un vecino del atlas. `src/lib/atlas-bounds.json` almacena estos rectángulos, y el SVG anidado los recorta sin modificar la imagen. `scripts/analyze-atlas.mjs` vuelve a medirlos sobre la vista local de revisión. Los SVG antiguos del mapa y del periódico no se usan como arte final.

Otros recursos originales: 12 dioramas de instalaciones (`facilities-atlas.webp`), 16 elementos de decoración (`props-atlas.webp`), seis escenas interiores con personajes ficticios (`interiors-atlas.webp`) y un paisaje de acceso (`kingdom-splash.webp`). Los interiores corresponden a finanzas, institucional, conciertos, marketing, redacción y cantera. La decoración incluye cuatro especies de árbol, setos, flores, fuente, monumento, farola, banco, quiosco, puerta, autobús, coche y material de obra.

Los derechos de las fotografías deportivas son independientes y se detallan en SPORTS_ASSETS.md. No se incluyen materiales de Kingshot, fotografías de músicos sin permiso ni retratos generados presentados como personas reales. La marca vectorial y los PNG de instalación se generan con `node scripts/icons.mjs`.
