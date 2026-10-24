import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { generatedDemo, snapshotOf } from '../server/demo/state.js';
import { invariant } from '../shared/math.js';
import type { GameState } from '../shared/types.js';

/** Only explicit paths are opened. Never instantiate Store against an existing file. */
export async function exportSqliteDemo(file: string, league: string) {
  const { DatabaseSync } = await import('node:sqlite');
  // Fail before opening a nonexistent path. SQLite readOnly cannot initialize/migrate it.
  readFileSync(file, { flag: 'r' });
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec('BEGIN');
    const row = db.prepare('SELECT state FROM leagues WHERE id=?').get(league) as
      { state: string } | undefined;
    invariant(row, 'Liga no encontrada en la copia SQLite indicada.');
    const state = JSON.parse(row.state) as GameState;
    const presidents: Record<string, string> = {};
    for (const c of state.clubs) {
      const user = db.prepare('SELECT name FROM users WHERE id=?').get(c.userId) as
        { name: string } | undefined;
      invariant(user, 'Presidente local inexistente.');
      presidents[c.userId] = user.name;
    }
    const snapshot = snapshotOf(state, 'explicit-sqlite-readonly', presidents);
    db.exec('ROLLBACK');
    return snapshot;
  } finally {
    db.close();
  }
}
export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      generated: { type: 'boolean' },
      sqlite: { type: 'string' },
      league: { type: 'string' },
      'confirm-demo-read': { type: 'boolean' },
      out: { type: 'string' },
      at: { type: 'string' },
      seed: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (!args.length || values.help) {
    console.log(
      'export:local-demo --generated --at ISO --seed SEMILLA --out ARCHIVO | --sqlite COPIA --league UUID --confirm-demo-read --out ARCHIVO',
    );
    return;
  }
  invariant(
    values.out && !!values.generated !== !!values.sqlite,
    'Indica --out y una única fuente explícita.',
  );
  let snapshot;
  if (values.sqlite) {
    invariant(
      values['confirm-demo-read'] && values.league,
      'La lectura SQLite necesita --league y --confirm-demo-read. No hay ruta personal por defecto.',
    );
    snapshot = await exportSqliteDemo(resolve(values.sqlite), values.league);
  } else {
    invariant(
      values.at && Number.isFinite(Date.parse(values.at)) && values.seed && values.seed.length >= 8,
      'Indica fecha ISO y semilla reproducible.',
    );
    snapshot = snapshotOf(
      generatedDemo('advanced', Date.parse(values.at), values.seed),
      'generated-local-demo',
    );
  }
  // Contains private bids/RNG/history, never a public asset. Never overwrite a snapshot.
  writeFileSync(resolve(values.out), JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  console.log(
    JSON.stringify({
      status: 'exported',
      league: snapshot.state.id,
      sha256: snapshot.sha256,
      source: snapshot.source,
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(() => {
    console.error(
      'No se pudo exportar. Revisa argumentos, permisos y que sea una demo coherente de seis presidentes; el archivo de salida no se sobrescribe.',
    );
    process.exitCode = 1;
  });
