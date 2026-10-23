import { writeFileSync } from 'node:fs';
import { BUILDINGS, FACILITIES, RESEARCH, RULES, MODULES, SPONSORS } from '../shared/config';
import { REAL_CLUBS, roster, SPORTS_VERSION } from '../shared/sports';
const at = Date.parse('2026-10-23T10:00:00Z');
writeFileSync(
  'data/catalogs.json',
  JSON.stringify(
    {
      generated: 'scripts/export-catalogs.ts; no editar a mano',
      version: SPORTS_VERSION,
      buildings: BUILDINGS,
      facilities: FACILITIES,
      research: RESEARCH,
      rules: RULES,
      modules: MODULES,
      sponsors: SPONSORS,
      clubs: REAL_CLUBS,
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(
  'data/players.json',
  JSON.stringify({ version: SPORTS_VERSION, players: roster(at) }, null, 2) + '\n',
);
console.log(
  `${BUILDINGS.length} edificios · ${FACILITIES.length} instalaciones · ${RESEARCH.length} investigaciones · ${roster(at).length} futbolistas exportados.`,
);
