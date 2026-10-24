import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

// Test Vercel's output, never source TS or a hand-generated replacement bundle.
const functions = resolve('.vercel/output/functions');
const worker = fileURLToPath(new URL('./vercel-artifact-worker.mjs', import.meta.url));
function discover(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.name.endsWith('.func') ? [path] : entry.isDirectory() ? discover(path) : [];
  });
}
const artifacts = discover(functions);
assert(artifacts.length > 0, 'Ejecuta npx vercel build --prod antes de esta prueba.');
for (const artifact of artifacts) {
  const config = JSON.parse(readFileSync(join(artifact, '.vc-config.json'), 'utf8'));
  assert.match(config.runtime, /^nodejs\d+\.x$/);
  assert.equal(
    Number(config.runtime.match(/\d+/)[0]),
    Number(process.versions.node.split('.')[0]),
    `Ejecuta esta prueba con la versión de producción: ${config.runtime}.`,
  );
  const work = mkdtempSync(join(tmpdir(), 'monigones-vercel-artifact-'));
  try {
    // Dereference traced symlinks and move outside the repository. A missing
    // dependency cannot accidentally resolve against the developer's node_modules.
    cpSync(artifact, join(work, 'function'), { recursive: true, dereference: true });
    const result = spawnSync(process.execPath, [worker, join(work, 'function')], {
      cwd: work,
      // Do not inherit production credentials, NODE_OPTIONS, NODE_PATH or TS loaders.
      env: { NODE_ENV: 'production' },
      encoding: 'utf8',
      timeout: 60000,
    });
    if (result.stdout) console.log(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `El artefacto ${artifact} no es ejecutable.`);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
