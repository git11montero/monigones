import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import assert from 'node:assert/strict';

/** Read-only verification of the compiled shell, not a source-code assertion. */
export function verifyPwaBuild(directory, publicConfig) {
  const root = resolve(directory);
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const version = JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8'));
  const worker = readFileSync(resolve(root, 'sw.js'), 'utf8');
  assert(
    version.buildId && worker.includes(version.buildId),
    'Worker and version.json must share a build ID',
  );
  const main = html.match(/<script[^>]+src="([^"]+)"/);
  assert(main, 'Compiled HTML must reference its versioned JavaScript');
  const bundle = readFileSync(resolve(root, '.' + main[1]), 'utf8');
  assert(bundle.includes(version.buildId), 'App and worker must share a build ID');
  assert(!worker.includes('self.__WB_MANIFEST'), 'Precache manifest must be injected');
  const entries = [...worker.matchAll(/"url":"([^"]+)"/g)].map((match) => match[1]);
  assert(
    entries.length > 20 && entries.includes('index.html'),
    'Shell must include HTML and lazy assets',
  );
  for (const url of entries) {
    assert(!url.startsWith('/api/'), 'API responses must never be precached');
    assert(
      existsSync(resolve(root, url.replace(/^\//, ''))),
      'Every precached resource must exist',
    );
  }
  if (publicConfig) {
    assert(bundle.includes(publicConfig.url), 'Public Supabase URL missing from compiled app');
    assert(bundle.includes(publicConfig.key), 'Public Supabase key missing from compiled app');
  }
  return {
    buildId: version.buildId,
    precachedResources: entries.length,
    publicConfigChecked: !!publicConfig,
  };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
  console.log(JSON.stringify(verifyPwaBuild(root)));
}
