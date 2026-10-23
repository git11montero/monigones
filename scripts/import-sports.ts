import { readFileSync } from 'node:fs';
import { ImportSportsProvider } from '../shared/sports';
const file = process.argv[2];
if (!file) throw Error('Uso: npm run sports:validate -- archivo.json|archivo.csv');
const text = readFileSync(file, 'utf8');
const provider = file.endsWith('.csv')
  ? ImportSportsProvider.fromCSV(text)
  : new ImportSportsProvider(JSON.parse(text));
const players = await provider.getPlayers();
console.log(
  `Catálogo válido: ${players.length} futbolistas; ${players.filter((p) => p.simulated).length} ficticios. Para importar en una liga usa Ajustes → Importación deportiva.`,
);
