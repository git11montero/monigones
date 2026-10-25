import process from 'node:process';
// Offline normalization of explicitly fetched public facts. Does not touch a game or service.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const folder = process.argv[2];
if (!folder) throw Error('Uso: node scripts/build-sports-catalog.mjs CARPETA_REFERENCIAS');
const legacy = JSON.parse(readFileSync('data/sports/legacy-v05.json', 'utf8'));
const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const clubIds = [
  'athletic',
  'atletico',
  'osasuna',
  'celta',
  'alaves',
  'elche',
  'barcelona',
  'getafe',
  'levante',
  'malaga',
  'racing',
  'deportivo',
  'espanyol',
  'betis',
  'madrid',
  'sociedad',
  'sevilla',
  'valencia',
  'villarreal',
  'rayo',
];
const required = new Set(
  'abdessamad-ezzalzouli raphinha lamine-yamal i-vicente fermin-lopez youssouf-fofana raul-moro m-llorente laporte alexander-freeman emil-audero t-martinez hugo-novoa salvi-esquivel yassir-zabiri isaac-romero giuliano-simeone alex-b pedri marc-pubill pau-cubarsi xavi-espart areso oblak guedes yan-diomande r-brugue d-ceballos edu-exposito mario-s pablo-barrios-rivas ibrahima-konate paredes-2 yoel-lago peter-gulacsi fer-nino jonathan-david david-otorbi isco izan-merino arda-guler lucien-agoume j-m-gimenez catena nicolas-valentini leo-1 budimir roberto-fernandez-2 martin-satriano felix-correia jude-bellingham c-soler luismi-cruz grimaldo justin-de-haas pedrosa-1 unai-simon'.split(
    ' ',
  ),
);
const roles = { Goalkeeper: 'POR', Defender: 'DEF', Midfielder: 'MED', Striker: 'DEL' };
const overrides = {
  'r-brugue': {
    position: 'DEL',
    source: 'https://www.levanteud.com/jugadores/roger-brugue',
    reason:
      'Delantero según su club y su ficha individual en LaLiga; la tabla estadística lo agrupa como Midfielder.',
  },
  'i-vicente': {
    position: 'MED',
    source: 'https://www.comuniate.com/jugadores/3010/inigo-vicente',
    reason: 'Mediapunta; posición Fantasy MED, distinta de la agrupación estadística Striker.',
  },
  'luismi-cruz': {
    position: 'MED',
    source: 'https://www.rcdeportivo.es/es/protagonistas-plantillas-historicas',
    reason: 'Centrocampista en la plantilla oficial del club.',
  },
  'm-llorente': {
    position: 'DEF',
    source: 'https://www.atleticodemadrid.com/jugadores/marcos-llorente-moreno-2026-2027',
    reason:
      'Adaptación Fantasy del carrilero a DEF, conservada de v0.5; ficha oficial lo clasifica como centrocampista polivalente.',
  },
  'hugo-novoa': {
    position: 'DEF',
    source: 'https://www.laliga.com/jugador/hugo-novoa',
    reason:
      'Defensa en la ficha individual de LaLiga, aunque la tabla estadística agrupa como Striker.',
  },
};
const aliases = {
  'vini-jr': 'Vinícius Júnior',
  'bernardo-silva': 'Bernardo Silva',
  'e-militao': 'Éder Militão',
  'cristian-romero': 'Cuti Romero',
  'abdessamad-ezzalzouli': 'Abde',
  ilaix: 'Ilaix Moriba',
  'x-navarro': 'Ximo',
  'adria-altimira': 'Altimira',
  't-morente': 'Tete Morente',
  'javier-morcillo': 'Javier Morcillo',
  'ezequiel-ponce': 'Eze Ponce',
  'jon-ander-olasagasti': 'Jon Olasagasti',
  'raul-4': 'Raúl García de Haro',
  guedes: 'Gonçalo Guedes',
  take: 'Take Kubo',
  'luiz-junior-1': 'Luiz Júnior',
  'logan-costa': 'Logan Costa',
};
const seen = new Set(),
  identities = new Set(),
  selected = [],
  sources = [];
for (const clubId of clubIds) {
  const raw = readFileSync(resolve(folder, `${clubId}.json`), 'utf8'),
    data = JSON.parse(raw);
  if (!data.seasons.includes(2026)) throw Error(`Temporada no verificada: ${clubId}`);
  const players = data.players.filter((p) => p.clubSlug === data.club.slug);
  players.sort(
    (a, b) =>
      Number(required.has(b.slug)) - Number(required.has(a.slug)) ||
      b.starts - a.starts ||
      b.minutes - a.minutes ||
      a.externalId.localeCompare(b.externalId),
  );
  const squad = players.slice(0, 25);
  // Ensure two real goalkeepers without displacing requested players or regular starters unnecessarily.
  for (const g of players.filter((p) => p.position === 'Goalkeeper').slice(0, 2))
    if (!squad.includes(g)) {
      const index = squad.findLastIndex(
        (p) => !required.has(p.slug) && p.position !== 'Goalkeeper',
      );
      if (index < 0) throw Error('No hay espacio para portero');
      squad[index] = g;
    }
  if (squad.length !== 25) throw Error(`Plantilla incompleta: ${clubId}`);
  sources.push({
    clubId,
    url: data.source,
    observedAt: data.observedAt,
    season: '2026/27',
    sha256: createHash('sha256').update(raw).digest('hex'),
    available: players.length,
    selected: 25,
  });
  for (const p of squad) {
    if (identities.has(p.externalId)) throw Error(`Identidad repetida ${p.externalId}`);
    identities.add(p.externalId);
    const candidates = legacy.filter(
      (o) =>
        !o.simulated &&
        o.realClubId === clubId &&
        [p.name, p.fullName].some((n) => norm(o.name) === norm(n)),
    );
    const loose = legacy.filter(
      (o) =>
        !o.simulated &&
        o.realClubId === clubId &&
        norm(o.name).length >= 5 &&
        [p.name, p.fullName].some((n) =>
          o.name
            .split(/\s+/)
            .every((part) => n.split(/\s+/).some((word) => norm(word) === norm(part))),
        ),
    );
    const alias =
      aliases[p.slug] &&
      legacy.find((o) => o.realClubId === clubId && o.name === aliases[p.slug] && !o.simulated);
    const old =
      alias ||
      (candidates.length === 1 ? candidates[0] : loose.length === 1 ? loose[0] : undefined);
    const retained = old && !seen.has(old.id) ? old : undefined;
    const id = retained?.id || `ll-${p.externalId}`;
    seen.add(id);
    const adaptation = overrides[p.slug];
    const position = adaptation?.position || roles[p.position];
    if (!position) throw Error(`Posición desconocida ${p.slug}`);
    selected.push({
      id,
      name: retained?.name || p.fullName,
      fullName: p.fullName,
      realClubId: clubId,
      position,
      externalIds: { laliga: p.externalId, opta: String(p.optaId), slug: p.slug },
      season: '2026/27',
      source: `https://www.laliga.com/jugador/${p.slug}`,
      verifiedAt: data.observedAt,
      reference: {
        starts: p.starts,
        minutes: p.minutes,
        sourcePosition: p.position,
        ...(adaptation ? { adaptation } : {}),
      },
    });
  }
}
for (const slug of required)
  if (!selected.some((p) => p.externalIds.slug === slug)) throw Error(`Falta ${slug}`);
writeFileSync(
  'data/sports/laliga-2026-27.json',
  JSON.stringify(
    { version: '2026-10-25.v06', season: '2026/27', sources, players: selected },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify(
    {
      players: selected.length,
      real: 500,
      legacyIdsRetained: selected.filter((p) => !p.id.startsWith('ll-')).length,
      adaptations: overrides,
    },
    null,
    2,
  ),
);
