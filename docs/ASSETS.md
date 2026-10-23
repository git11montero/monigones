> Documento de la entrega inicial v0.1. Para el rediseño MONIGONES consulta [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md), [BUILDING_ASSETS.md](BUILDING_ASSETS.md) y [SPORTS_ASSETS.md](SPORTS_ASSETS.md).

# Inventario gráfico

| Recurso                    | Ubicación                    | Procedencia y sustitución                                                 |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Escudo CROWN XI            | `public/assets/crown.svg`    | Vector original; generado por `scripts/icons.mjs`                         |
| Iconos instalables 192/512 | `public/icon-*.png`          | Ráster propio a partir de polígonos; icono maskable con margen            |
| Suelo, caminos y árboles   | `src/components/City.tsx`    | SVG original, sin imagen de fondo externa                                 |
| Edificios y niveles        | `BuildingArt`, mismo archivo | SVG paramétrico independiente; niveles modifican geometría                |
| Escudos de clubes fantasy  | `Crest` en `ui.tsx`          | Diseño original con color e iniciales                                     |
| Avatares de jugadores      | `PlayerAvatar` en `ui.tsx`   | Rostros estilizados originales; se identifica club mediante texto y color |
| Entrenadores               | `ManagementPages.tsx`        | Avatar original, sin fotografía real                                      |
| Camiseta comercial         | `MarketingPage`              | Vector original con patrocinador ficticio                                 |
| Carteles de conciertos     | `ConcertsPage` y CSS         | Arte tipográfico original; nombres de artistas como metadatos             |
| Ilustración del periódico  | `NewspaperPage`              | Estadio vectorial original                                                |
| Actividades y calidades    | `ManagementPages.tsx` y CSS  | Composición original con iconos Lucide                                    |
| Iconos funcionales         | `lucide-react`               | Licencia ISC de la dependencia; no se usan logos deportivos descargados   |
| Tipografía                 | `src/styles.css`             | Familias del sistema y Georgia; no fuentes externas descargadas           |
| Capturas QA                | `docs/screenshots/`          | Playwright; pueden regenerarse al probar                                  |

No hay fotografías, música, escudos oficiales ni archivos redistribuidos de los juegos de referencia. Los campos de avatar/fuente del proveedor permiten incorporar medios autorizados. El diseño no depende de solicitudes de imagen a terceros.
