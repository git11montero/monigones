import { imageDimensions } from './sports-image-info';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { roster } from '../shared/sports';
import { AUTHORIZED_PHOTOS, CLUB_ASSETS, sportsAsset } from '../shared/sports-assets';
const players = roster(Date.now()),
  file = process.argv[2];
if (file) {
  throw Error(
    'La importación automática de fotografías está retirada. Sustituye manualmente el PNG indicado en docs/INVENTARIO_IMAGENES.csv y ejecuta images:manifest y build:online.',
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
