import { execFileSync } from 'node:child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { roster, REAL_CLUBS } from '../shared/sports';
import { CLUB_SLUGS, ALL_FOOTBALL_ASSETS } from '../shared/football-assets';
import { AUTHORIZED_PHOTOS } from '../shared/sports-assets';
const root = 'public/assets/futbol',
  players = roster(0),
  make = process.argv.includes('--prepare');
const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
const overrides: Record<string, string> = {
  'madrid-13': 'mbappe',
  'madrid-14': 'vinicius',
  'barcelona-17': 'lamineyamal',
};
type Entry = {
  playerId: string;
  clubId: string;
  name: string;
  resourceId: string;
  fileName: string;
  photo: string;
  crest: string;
};
const existing = JSON.parse(readFileSync('shared/football-assets.json', 'utf8')) as Entry[];
const legacyEntries = JSON.parse(
  readFileSync('data/sports/football-assets-v05.json', 'utf8'),
) as Entry[];
const reservedResources = new Set(ALL_FOOTBALL_ASSETS.map((e) => e.resourceId));
const entries: Entry[] = players.map((p) => {
  const old =
      legacyEntries.find((x) => x.playerId === p.id) || existing.find((x) => x.playerId === p.id),
    proposed = overrides[p.id] || slug(p.name);
  const resourceId =
    old?.resourceId || (reservedResources.has(proposed) ? `${proposed}-${slug(p.id)}` : proposed);
  reservedResources.add(resourceId);
  const fileName = `${CLUB_SLUGS[p.realClubId]}-${resourceId}.png`;
  return {
    playerId: p.id,
    clubId: p.realClubId,
    name: p.name,
    resourceId,
    fileName,
    photo: `/assets/futbol/jugadores/${fileName}`,
    crest: `/assets/futbol/escudos/${CLUB_SLUGS[p.realClubId]}.webp`,
  };
});
for (const e of entries)
  if (entries.some((x) => x.playerId !== e.playerId && x.resourceId === e.resourceId)) {
    e.resourceId += '-' + slug(e.playerId);
    e.fileName = `${CLUB_SLUGS[e.clubId]}-${e.resourceId}.png`;
    e.photo = `/assets/futbol/jugadores/${e.fileName}`;
  }
if (!make && JSON.stringify(existing) !== JSON.stringify(entries))
  throw Error(
    'Catálogo desactualizado o con colisiones: ejecuta npm run images:prepare y revisa sus cambios.',
  );
if (
  new Set(entries.map((e) => e.resourceId)).size !== entries.length ||
  new Set(entries.map((e) => e.playerId)).size !== entries.length
)
  throw Error('Identidades o recursos duplicados.');
if (make) {
  for (const dir of ['jugadores', 'escudos', 'fallback'])
    mkdirSync(`${root}/${dir}`, { recursive: true });
  for (const e of entries)
    if (!existsSync('public' + e.photo))
      copyFileSync(`${root}/fallback/jugador.png`, 'public' + e.photo);
  for (const c of REAL_CLUBS)
    if (!existsSync(`${root}/escudos/${CLUB_SLUGS[c.id]}.png`))
      copyFileSync(`${root}/fallback/escudo.png`, `${root}/escudos/${CLUB_SLUGS[c.id]}.png`);
  for (const c of REAL_CLUBS) {
    const base = `${root}/escudos/${CLUB_SLUGS[c.id]}`;
    if (!existsSync(base + '.webp') || process.argv.includes('--refresh-crests'))
      execFileSync('magick', [
        base + '.png',
        '-resize',
        '256x256',
        '-background',
        'none',
        '-gravity',
        'center',
        '-extent',
        '256x256',
        '-define',
        'webp:lossless=true',
        base + '.webp',
      ]);
  }
  writeFileSync('shared/football-assets.json', JSON.stringify(entries, null, 2) + '\n');
}
const decodedHashes = new Set<string>();
function png(file: string) {
  const b = readFileSync(file);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error(`No es PNG: ${file}`);
  let offset = 8,
    w = 0,
    h = 0;
  const data: Buffer[] = [];
  let end = false;
  while (offset + 12 <= b.length) {
    const n = b.readUInt32BE(offset),
      type = b.toString('ascii', offset + 4, offset + 8);
    if (offset + 12 + n > b.length) throw Error(`PNG truncado: ${file}`);
    if (type === 'IHDR') {
      w = b.readUInt32BE(offset + 8);
      h = b.readUInt32BE(offset + 12);
    }
    if (type === 'IDAT') data.push(b.subarray(offset + 8, offset + 8 + n));
    if (type === 'IEND') {
      end = true;
      break;
    }
    offset += 12 + n;
  }
  if (!end || w < 64 || h < 64 || w > 4096 || h > 4096 || !inflateSync(Buffer.concat(data)).length)
    throw Error(`PNG inválido o dimensiones no razonables: ${file}`);
  const hash = createHash('sha256').update(b).digest('hex');
  if (!decodedHashes.has(hash)) {
    execFileSync('magick', [file, '-regard-warnings', 'null:'], { stdio: 'pipe' });
    decodedHashes.add(hash);
  }
  return { w, h, hash };
}
const fallbackPlayer = png(`${root}/fallback/jugador.png`),
  fallbackClub = png(`${root}/fallback/escudo.png`),
  seen = new Set<string>(),
  rows: string[][] = [];
let placeholders = 0,
  provided = 0,
  licensed = 0;
for (const e of entries) {
  if (seen.has(e.photo)) throw Error('Colisión: ' + e.photo);
  seen.add(e.photo);
  if (!/^[a-z0-9]+-[a-z0-9-]+\.png$/.test(e.fileName))
    throw Error('Nombre inválido: ' + e.fileName);
  const image = png('public' + e.photo),
    placeholder = image.hash === fallbackPlayer.hash,
    known = AUTHORIZED_PHOTOS.find((x) => x.playerId === e.playerId);
  if (placeholder) placeholders++;
  else if (
    known &&
    existsSync(`assets-source/futbol/authorized-${e.playerId}.sha256`) &&
    image.hash ===
      readFileSync(`assets-source/futbol/authorized-${e.playerId}.sha256`, 'utf8').trim()
  )
    licensed++;
  else provided++;
  rows.push([
    'Jugador',
    e.playerId,
    REAL_CLUBS.find((x) => x.id === e.clubId)!.name,
    e.name,
    e.fileName,
    e.photo,
    placeholder
      ? 'Placeholder'
      : known && image.hash === readSafeHash(e.playerId)
        ? 'Fotografía autorizada'
        : 'Aportada por el usuario (derechos no verificados)',
    `${image.w}x${image.h}; recurso ${e.resourceId}`,
  ]);
}
function readSafeHash(id: string) {
  const f = `assets-source/futbol/authorized-${id}.sha256`;
  return existsSync(f) ? readFileSync(f, 'utf8').trim() : '';
}
for (const c of REAL_CLUBS) {
  const file = `${CLUB_SLUGS[c.id]}.webp`;
  const bytes = readFileSync(`${root}/escudos/${file}`);
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP')
    throw Error(`No es WebP: ${file}`);
  const dimensions = execFileSync(
    'magick',
    ['identify', '-format', '%w %h', `${root}/escudos/${file}`],
    { encoding: 'utf8' },
  )
    .trim()
    .split(' ')
    .map(Number);
  if (dimensions[0] !== 256 || dimensions[1] !== 256)
    throw Error(`Dimensiones inconsistentes: ${file}`);
  execFileSync('magick', [`${root}/escudos/${file}`, '-regard-warnings', 'null:']);
  const image = {
    w: dimensions[0],
    h: dimensions[1],
    hash: createHash('sha256').update(bytes).digest('hex'),
  };
  png(`${root}/escudos/${CLUB_SLUGS[c.id]}.png`);
  rows.push([
    'Escudo',
    c.id,
    c.name,
    '',
    file,
    `/assets/futbol/escudos/${file}`,
    image.hash === fallbackClub.hash
      ? 'Placeholder genérico'
      : 'Aportado por el usuario (derechos no verificados)',
    `${image.w}x${image.h}`,
  ]);
}
const historical = ALL_FOOTBALL_ASSETS.filter(
  (e) => !entries.some((p) => p.playerId === e.playerId),
);
for (const e of historical) {
  const image = png('public' + e.photo);
  rows.push([
    'Jugador histórico',
    e.playerId,
    e.clubId,
    e.name,
    e.fileName,
    e.photo,
    'Compatibilidad con partidas anteriores',
    `${image.w}x${image.h}; recurso ${e.resourceId}`,
  ]);
}
const csv = (row: string[]) => row.map((v) => '"' + v.replaceAll('"', '""') + '"').join(',');
writeFileSync(
  'docs/INVENTARIO_IMAGENES.csv',
  [
    [
      'Tipo',
      'ID interno',
      'Club',
      'Jugador',
      'Nombre de archivo',
      'Ruta',
      'Estado',
      'Observaciones',
    ],
    ...rows,
  ]
    .map(csv)
    .join('\n') + '\n',
);
const report = {
  players: entries.length,
  clubs: REAL_CLUBS.length,
  placeholders,
  licensedPhotos: licensed,
  userProvided: provided,
  activePngs: entries.length + REAL_CLUBS.length + 2,
  expectedPngs: entries.length + historical.length + REAL_CLUBS.length + 2,
  webpCrests: REAL_CLUBS.length,
  historicalPngs: ALL_FOOTBALL_ASSETS.filter((x) => !entries.some((e) => e.playerId === x.playerId))
    .length,
  unexpectedFiles: readdirSync(root + '/jugadores').filter(
    (f) => !ALL_FOOTBALL_ASSETS.some((e) => e.fileName === f),
  ),
  result: 'PASS PNG/WebP signatures, full ImageMagick decode, dimensions and unique paths',
};
mkdirSync('docs/validation/v06', { recursive: true });
writeFileSync('docs/validation/v06/images.json', JSON.stringify(report, null, 2) + '\n');
console.log(report);
