const { fetch, AbortSignal } = globalThis;
import process from 'node:process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const slugs = {
  athletic: 'athletic-club',
  atletico: 'atletico-de-madrid',
  osasuna: 'c-a-osasuna',
  celta: 'rc-celta',
  alaves: 'd-alaves',
  elche: 'elche-c-f',
  barcelona: 'fc-barcelona',
  getafe: 'getafe-cf',
  levante: 'levante-ud',
  malaga: 'malaga-cf',
  racing: 'r-racing-club',
  deportivo: 'rc-deportivo',
  espanyol: 'rcd-espanyol',
  betis: 'real-betis',
  madrid: 'real-madrid',
  sociedad: 'real-sociedad',
  sevilla: 'sevilla-fc',
  valencia: 'valencia-cf',
  villarreal: 'villarreal-cf',
  rayo: 'rayo-vallecano',
};
if (process.argv[2] !== '--fetch' || !process.argv[3])
  throw Error(
    'Uso explícito: node scripts/fetch-sports-reference.mjs --fetch CARPETA_TEMPORAL. Solo descarga HTML de LaLiga, nunca imágenes ni partidas.',
  );
const output = resolve(process.argv[3]);
mkdirSync(output, { recursive: true });
const entries = Object.entries(slugs).filter(
  ([id]) => !process.argv[4] || process.argv[4].split(',').includes(id),
);
for (let offset = 0; offset < entries.length; offset += 4) {
  const batch = await Promise.allSettled(
    entries.slice(offset, offset + 4).map(async ([id, slug]) => {
      const url = `https://www.laliga.com/clubes/${slug}/estadisticas`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw Error(`${id}: HTTP ${response.status}`);
      const html = await response.text();
      const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (!match) throw Error(`${id}: no hay datos estructurados verificables.`);
      const data = JSON.parse(match[1]).props?.pageProps;
      if (
        data?.statusCode !== 200 ||
        !data.club ||
        !Array.isArray(data.playersStats) ||
        data.playersStats.length < 20
      )
        throw Error(`${id}: tabla incompleta.`);
      const seasons = [
        ...new Set(
          Object.values(data.leadersStats || {})
            .flat()
            .map((p) => p.opta_season_id)
            .filter(Boolean),
        ),
      ];
      const players = data.playersStats.map((row) => {
        const e = row.extra_info,
          stats = Object.fromEntries(row.stats.map((s) => [s.name, s.stat]));
        return {
          externalId: String(e.playerId),
          optaId: row.opta_player_id,
          name: e.name,
          fullName: [e.firstname, e.lastname].filter(Boolean).join(' '),
          slug: e.slug,
          position: row.position,
          positionId: e.positionId,
          clubSlug: e.teamSlug,
          shirt: e.shirtNumber,
          starts: stats.starts || 0,
          appearances: stats.games_played || stats.appearances || 0,
          minutes: stats.time_played || 0,
        };
      });
      const result = {
        id,
        source: url,
        observedAt: '2026-10-25',
        seasons,
        club: {
          externalId: String(data.club.id),
          slug: data.club.slug,
          name: data.club.nickname,
          officialName: data.club.name,
        },
        players,
      };
      writeFileSync(resolve(output, `${id}.json`), JSON.stringify(result, null, 2) + '\n');
      return { club: id, players: players.length, seasons };
    }),
  );
  for (const result of batch) {
    if (result.status === 'rejected') {
      console.error(result.reason.message);
      process.exitCode = 1;
    } else console.log(JSON.stringify(result.value));
  }
}
