import { imageDimensions } from './sports-image-info';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { roster } from '../shared/sports';
import { AUTHORIZED_PHOTOS, CLUB_ASSETS, sportsAsset } from '../shared/sports-assets';
import { validateMediaPackage } from '../shared/sports-media-validation';
const players = roster(Date.now()),
  file = process.argv[2];
if (file) {
  const full = resolve(file),
    root = dirname(full),
    pkg = validateMediaPackage(JSON.parse(readFileSync(full, 'utf8')), players),
    imported = [];
  for (const photo of pkg.photos) {
    const source = resolve(root, photo.file),
      rel = relative(root, source);
    if (rel.startsWith('..') || rel.startsWith('/'))
      throw Error('El archivo debe estar dentro del paquete.');
    const bytes = readFileSync(source);
    if (createHash('sha256').update(bytes).digest('hex') !== photo.sha256)
      throw Error(`Hash incorrecto: ${photo.playerId}`);
    const actual = imageDimensions(bytes);
    if (actual.width !== photo.width || actual.height !== photo.height)
      throw Error(`Dimensiones incorrectas: ${photo.playerId}`);
    const ext = extname(source).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) throw Error('Formato no permitido.');
    const target = `/sports/imported/${photo.playerId}-${photo.sha256.slice(0, 12)}${ext}`;
    mkdirSync('public/sports/imported', { recursive: true });
    if (!existsSync('public' + target)) copyFileSync(source, 'public' + target);
    const { sha256: _, clubId: __, ...record } = photo;
    imported.push({ ...record, file: target });
  }
  writeFileSync(
    'shared/imported-sports-assets.ts',
    `import type { AuthorizedPhoto } from './sports-assets';\nexport const IMPORTED_PHOTOS: AuthorizedPhoto[] = ${JSON.stringify(imported, null, 2)};\n`,
  );
  console.log(
    `${imported.length} fotografías importadas. Ejecuta sports:assets y build para verificar y publicar la nueva cobertura.`,
  );
} else {
  const records = players.map(sportsAsset),
    real = players.filter((p) => !p.simulated),
    available = records.filter((r) => r.photo),
    report = {
      generatedAt: new Date().toISOString(),
      real: real.length,
      fictional: players.length - real.length,
      authorizedPhotos: available.length,
      pendingPhotos: real.length - available.length,
      officialCrests: CLUB_ASSETS.filter((c) => c.official).length,
      alternativeCrests: CLUB_ASSETS.length,
      photoCoveragePercent: Number(((available.length / real.length) * 100).toFixed(2)),
      photos: AUTHORIZED_PHOTOS,
      clubs: CLUB_ASSETS,
      records,
    };
  const digests = new Set<string>();
  for (const photo of AUTHORIZED_PHOTOS) {
    if (!existsSync('public' + photo.file)) throw Error(`Foto no encontrada: ${photo.file}`);
    const bytes = readFileSync('public' + photo.file),
      actual = imageDimensions(bytes),
      digest = createHash('sha256').update(bytes).digest('hex');
    if (actual.width !== photo.width || actual.height !== photo.height)
      throw Error(`Dimensiones incorrectas: ${photo.playerId}`);
    if (digests.has(digest)) throw Error('Foto repetida entre identidades.');
    digests.add(digest);
  }
  mkdirSync('data', { recursive: true });
  writeFileSync('data/sports-asset-catalog.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ ...report, photos: undefined, clubs: undefined, records: undefined }, null, 2),
  );
}
