import { writeFileSync } from 'node:fs';
import { mediaStatus } from '../server/football-media';
const status = mediaStatus();
if (Object.values(status).some((item) => item.kind === 'missing'))
  throw Error('Faltan imágenes del catálogo. Ejecuta npm run images:validate.');
writeFileSync('public/assets/futbol/manifest.json', JSON.stringify(status));
console.log(`Manifiesto estático: ${Object.keys(status).length} PNG con versión de contenido.`);
