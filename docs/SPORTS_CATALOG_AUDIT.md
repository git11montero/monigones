# Catálogo deportivo v0.6

Fecha de consulta: 25/10/2026. Temporada: 2026/27. **500 identidades reales, 25 por cada uno de los veinte clubes**. No hay relleno ficticio en las partidas nuevas. Identidad, club, posición, temporada e identificadores externos son independientes del valor de mercado y los puntos del simulador.

La fuente primaria es la [relación oficial de clubes de LaLiga](https://www.laliga.com/laliga-easports/clubes) y los datos estructurados de sus páginas `/clubes/<slug>/estadisticas`. Las veinte URL, fecha y SHA-256 de cada referencia están en [el catálogo normalizado](../data/sports/laliga-2026-27.json). Las referencias compactas, sin fotos ni URL de imágenes, quedan archivadas en `data/sports/reference-v06/`. Cada jugador incluye su ficha individual como fuente y sus IDs LaLiga/Opta.

Selección: jugadores solicitados para la demo, después titularidades y minutos observados, garantizando dos porteros. Es una selección de plantilla, no una predicción del siguiente once. Las tablas estadísticas pueden agrupar demarcaciones de forma distinta a las fichas individuales. Estas cinco decisiones están registradas por jugador:

| Jugador | Posición del juego | Justificación |
|---|---|---|
| Roger Brugué | DEL | [Levante](https://www.levanteud.com/jugadores/roger-brugue) y [ficha LaLiga](https://www.laliga.com/jugador/r-brugue): delantero; la tabla estadística dice Midfielder. |
| Hugo Novoa | DEF | [Ficha LaLiga](https://www.laliga.com/jugador/hugo-novoa): defensa; la tabla dice Striker. |
| Luismi Cruz | MED | [Plantilla del Deportivo](https://www.rcdeportivo.es/es/protagonistas-plantillas-historicas): centrocampista; la tabla dice Striker. |
| Iñigo Vicente | MED | Adaptación Fantasy de mediapunta, documentada en [su perfil de posición](https://www.comuniate.com/jugadores/3010/inigo-vicente). LaLiga lo agrupa como Striker. |
| Marcos Llorente | DEF | Se conserva la posición Fantasy de v0.5 para el carrilero. Su [club](https://www.atleticodemadrid.com/jugadores/marcos-llorente-moreno-2026-2027) lo clasifica como centrocampista polivalente y también describe su función de carrilero. No se presenta DEF como la etiqueta oficial de esa ficha. |

Fermín López corresponde al FC Barcelona, según corrección expresa del usuario y ficha oficial. «A. Santos» permanece sin identidad ni club asignados; no se ha equiparado a Antony. «D. Gulácsi» se ha normalizado a **Péter Gulácsi**, portero del Villarreal, con [ficha oficial](https://www.laliga.com/jugador/peter-gulacsi) y [anuncio del club](https://villarrealcf.es/en/peter-gulacsi-nuevo-portero-del-villarreal-cf/); la inicial escrita no coincide y debe revisarse en la previsualización.

## Compatibilidad y reproducción

Se conservan 360 identificadores de identidades verificadas de v0.5. Para otras altas se utiliza `ll-<id oficial>`. Nunca se reutiliza un ID ficticio para una persona real. Los apodos que cambian de grafía tienen correspondencias explícitas en el normalizador. Los 500 registros antiguos y sus recursos están archivados en `data/sports/legacy-v05.json` y `football-assets-v05.json`; las instantáneas aceptadas deben coincidir íntegramente con uno de los dos catálogos, sin mezclarlos. Las partidas SQLite y PostgreSQL existentes mantienen su catálogo embebido, contratos e históricos: abrirlas no ejecuta una actualización deportiva.

Reproducir sin red:

```sh
node scripts/build-sports-catalog.mjs data/sports/reference-v06
node --import tsx scripts/export-catalogs.ts
npm run images:prepare
npm run sports:assets
```

Actualizar referencias requiere una acción explícita y revisión de diferencias:

```sh
node scripts/fetch-sports-reference.mjs --fetch /tmp/monigones-nuevas-referencias
```

Ese comando descarga exclusivamente HTML público. No descarga fotos ni importa datos en partidas. El script SQL histórico `supabase/seed.sql` no se ha usado para actualizar producción; el catálogo que utiliza el motor online se incluye en el backend construido. No hay migración nueva ni actualización automática de ligas existentes.
