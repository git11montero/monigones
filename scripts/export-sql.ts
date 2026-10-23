import { writeFileSync } from 'node:fs';
import { BUILDINGS, FACILITIES, RESEARCH, RULES, SPONSORS, ARTISTS } from '../shared/config';
import { REAL_CLUBS, COACHES, roster } from '../shared/sports';
const q = (v: unknown): string =>
  v == null
    ? 'null'
    : typeof v === 'number'
      ? String(v)
      : typeof v === 'boolean'
        ? String(v)
        : `'${String(v).replaceAll("'", "''")}'`;
const j = (v: unknown) => q(JSON.stringify(v)) + '::jsonb';
const lines = [
  '-- Generado desde shared/config.ts y shared/sports.ts. Ejecutar npm run catalogs.',
  'begin;',
];
const insert = (t: string, cols: string, rows: string[]) => {
  if (rows.length)
    lines.push(
      `insert into public.${t}(${cols}) values\n${rows.map((row) => '(' + row + ')').join(',\n')}\non conflict do nothing;`,
    );
};
insert(
  'real_clubs',
  'id,name,short_name,color,source_url',
  REAL_CLUBS.map((c) => [c.id, c.name, c.short, c.color, c.source].map(q).join(',')),
);
insert(
  'coaches',
  'id,name,real_club_id,sport_bonus_bps,simulated,source_url',
  COACHES.map((c) =>
    [c.id, c.name, c.clubId, c.sportBonus, c.simulated, c.source].map(q).join(','),
  ),
);
const players = roster(Date.parse('2026-10-23T10:00:00Z'));
insert(
  'players',
  'id,name,real_club_id,position,simulated,source_url,verified_at',
  players.map((p) =>
    [
      p.id,
      p.name,
      p.realClubId,
      p.position,
      p.simulated,
      p.source,
      p.verifiedAt ? p.verifiedAt + 'T00:00:00Z' : null,
    ]
      .map(q)
      .join(','),
  ),
);
insert(
  'player_market_values',
  'player_id,at,value_cents,simulated',
  players.map((p) => [p.id, '2026-10-23T10:00:00Z', p.value, true].map(q).join(',')),
);
insert(
  'building_definitions',
  'id,name,max_level,configuration',
  BUILDINGS.map((b) => [q(b.id), q(b.name), q(b.max), j(b)].join(',')),
);
insert(
  'facility_definitions',
  'id,name,max_level,configuration',
  FACILITIES.map((f) => [q(f.id), q(f.name), q(f.max), j(f)].join(',')),
);
insert(
  'research_definitions',
  'id,name,tree,branch,max_level,building_level,effects',
  RESEARCH.map(
    (r) =>
      [r.id, r.name, r.tree, r.branch, r.maxLevel, r.buildingLevel].map(q).join(',') +
      ',' +
      j(r.effects),
  ),
);
insert(
  'research_dependencies',
  'node_id,requires_id',
  RESEARCH.flatMap((r) => r.requires.map((id) => [r.id, id].map(q).join(','))),
);
insert(
  'sponsor_definitions',
  'id,name,configuration',
  SPONSORS.map((s) => [q(s.id), q(s.name), j(s)].join(',')),
);
insert(
  'concert_definitions',
  'id,artist_name,configuration',
  ARTISTS.map((a) => [q(a.id), q(a.name), j(a)].join(',')),
);
insert(
  'game_configuration',
  'key,value',
  Object.entries(RULES).map(([k, v]) => q(k) + ',' + j(v)),
);
lines.push('commit;');
writeFileSync('supabase/seed.sql', lines.join('\n') + '\n');
