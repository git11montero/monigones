import { existsSync, realpathSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { invariant } from '../../shared/math.js';
/** Aggregate backups contain private game data; never permit exports into application assets/source. */
export function privateDirectory(directory: string) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  let parent = resolve(directory);
  const suffix: string[] = [];
  while (!existsSync(parent)) {
    suffix.unshift(parent.slice(dirname(parent).length + 1));
    parent = dirname(parent);
  }
  const destination = resolve(realpathSync(parent), ...suffix),
    path = relative(root, destination);
  invariant(
    path.startsWith(`..${sep}`) || path === '..' || path.startsWith(`.monigones-demo${sep}`),
    'REPLACE_BACKUP_DIRECTORY_MUST_BE_PRIVATE',
  );
  return destination;
}
