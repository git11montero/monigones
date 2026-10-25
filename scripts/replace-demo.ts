import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import target from '../examples/demo-replacement.production.json' with { type: 'json' };
import { SupabaseRpc } from '../server/online/transport.js';
import {
  ReplacementService,
  replacementConfig,
  digest,
  REPLACED_DATA,
} from '../server/demo/replacement.js';
import { previewSqlite, applySqlite, verifySqlite } from '../server/demo/sqlite-replacement.js';
import { fantasySnapshot } from '../server/demo/fantasy.js';
import source from '../data/demo-fantasy-v06.json' with { type: 'json' };
import { validateTarget } from './seed-online-demo.js';
import { invariant } from '../shared/math.js';
import { privateDirectory } from '../server/demo/private-directory.js';
export const confirmation = (
  action: string,
  environment: string,
  project: string,
  league: string,
  backup: string,
  restore?: string,
) => `${action} ${environment} ${project} ${league} ${backup}${restore ? ` DESDE ${restore}` : ''}`;
async function confirm(phrase: string) {
  invariant(
    process.stdin.isTTY && process.stdout.isTTY,
    'REPLACE_APPLY_REQUIRES_INTERACTIVE_TERMINAL',
  );
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    invariant(
      (await terminal.question(`Escribe exactamente «${phrase}»: `)).trim() === phrase,
      'REPLACE_CANCELLED',
    );
  } finally {
    terminal.close();
  }
}
export async function main(args = process.argv.slice(2)) {
  const { values: v } = parseArgs({
    args,
    strict: true,
    options: {
      target: { type: 'string' },
      config: { type: 'string' },
      'env-file': { type: 'string' },
      sqlite: { type: 'string' },
      league: { type: 'string' },
      'backup-dir': { type: 'string' },
      operation: { type: 'string' },
      restore: { type: 'string' },
      'dry-run': { type: 'boolean' },
      apply: { type: 'boolean' },
      verify: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (v.help || !args.length) {
    console.log(
      'demo:replace --target local|production|staging --dry-run|--apply|--verify [--restore BACKUP_UUID] [--operation UUID] [--config ARCHIVO --env-file ARCHIVO] [--sqlite ARCHIVO --league UUID] [--backup-dir CARPETA_PRIVADA]\nNo hay --force. Apply exige confirmación interactiva. Dry-run/verify no escriben.',
    );
    return;
  }
  invariant(
    ['local', 'production', 'staging'].includes(v.target || '') &&
      [v['dry-run'], v.apply, v.verify].filter(Boolean).length === 1,
    'REPLACE_CHOOSE_TARGET_AND_ACTION',
  );
  invariant(!v.restore || !v.verify, 'REPLACE_RESTORE_REQUIRES_PREVIEW_OR_APPLY');
  // Identity validation before opening any database or credential file.
  fantasySnapshot(source, Date.parse(target.sourceAt), target.seed);
  const operation = v.operation || randomUUID();
  invariant(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(operation),
    'REPLACE_OPERATION_UUID',
  );
  const directory = privateDirectory(v['backup-dir'] || '.monigones-demo/backups');
  let result: any, report: any, league: string, project: string;
  if (v.target === 'local') {
    invariant(!v.config && !v['env-file'], 'REPLACE_LOCAL_NO_CREDENTIALS');
    const file = resolve(v.sqlite || process.env.CROWN_DB || 'data/crown.sqlite');
    if (v.verify) {
      console.log(JSON.stringify(verifySqlite(file, v.league), null, 2));
      return;
    }
    const preview = previewSqlite(file, directory, v.league, v.restore);
    league = preview.inspection.current.row.id;
    project = 'local';
    report = preview.report;
    console.log(
      JSON.stringify(
        {
          target: 'local',
          project,
          league,
          admin: 'demo1',
          backup: operation,
          backupDirectory: directory,
          restoreFrom: v.restore || null,
          plan: report,
          expected: preview.inspection.fingerprint,
        },
        null,
        2,
      ),
    );
    if (v['dry-run']) return;
    await confirm(
      confirmation(
        v.restore ? 'RESTAURAR' : 'SUSTITUIR',
        'local',
        project,
        league,
        operation,
        v.restore,
      ),
    );
    result = await applySqlite(file, directory, operation, preview, v.restore);
    result.verification = verifySqlite(file, league);
  } else {
    invariant(v.config, 'REPLACE_PRODUCTION_REQUIRES_PRIVATE_CONFIG');
    const c = replacementConfig(JSON.parse(readFileSync(resolve(v.config), 'utf8')));
    invariant(c.environment === v.target, 'REPLACE_WRONG_ENVIRONMENT');
    if (v.target === 'production')
      invariant(
        c.projectRef === target.projectRef &&
          c.leagueId === target.leagueId &&
          c.adminUserId === target.adminUserId,
        'REPLACE_WRONG_PRODUCTION_TARGET',
      );
    if (v['env-file']) process.loadEnvFile(v['env-file']);
    const secret = process.env.MONIGONES_DEMO_SECRET_KEY || '';
    const url = validateTarget(c, process.env.MONIGONES_DEMO_SUPABASE_URL || '', secret);
    const service = new ReplacementService(new SupabaseRpc(url, secret));
    if (v.verify) {
      console.log(JSON.stringify(await service.verify(c), null, 2));
      return;
    }
    const preview = await service.preview(c, v.restore || null);
    league = c.leagueId;
    project = c.projectRef;
    report = preview.report;
    console.log(
      JSON.stringify(
        {
          target: v.target,
          project,
          league,
          admin: c.adminUserId,
          backup: operation,
          backupDirectory: directory,
          restoreFrom: v.restore || null,
          problems: preview.problems,
          otherUsers: preview.otherUsers,
          modifiedSinceImport:
            preview.inspection.current.game.revision !==
            preview.inspection.current.seed.baseline_revision,
          plan: report,
          expected: preview.inspection.fingerprint,
        },
        null,
        2,
      ),
    );
    invariant(!preview.problems.length, preview.problems.join(', '));
    if (v['dry-run']) return;
    await confirm(
      confirmation(
        v.restore ? 'RESTAURAR' : 'SUSTITUIR',
        c.environment,
        project,
        league,
        operation,
        v.restore,
      ),
    );
    result = await service.apply(c, operation, preview, v.restore || null);
    // The server's immutable checkpoint exists even if this filesystem export fails. Retry with --operation.
    try {
      const b = await service.backup(operation);
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const path = join(directory, `${operation}.postgres.json`);
      try {
        writeFileSync(
          path,
          JSON.stringify({
            format: 'monigones-postgres-backup-v1',
            backup: b,
            localChecksum: digest(b),
          }),
          { flag: 'wx', mode: 0o600 },
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const existing = JSON.parse(readFileSync(path, 'utf8'));
        invariant(
          existing.format === 'monigones-postgres-backup-v1' &&
            existing.localChecksum === digest(b) &&
            digest(existing.backup) === digest(b),
          'REPLACE_BACKUP_EXPORT_COLLISION',
        );
      }
    } catch {
      throw Error(
        `REPLACE_COMMITTED_BACKUP_EXPORT_FAILED: ${operation}. Conservado en PostgreSQL; repite con --operation ${operation}.`,
      );
    }
    result.verification = await service.verify(c);
  }
  const audit = {
    at: new Date().toISOString(),
    environment: v.target,
    project,
    league,
    operation,
    restoreFrom: v.restore || null,
    replaced: REPLACED_DATA,
    comparison: report,
    result,
  };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(
    join(directory, `${operation}.${randomUUID()}.report.json`),
    JSON.stringify(audit, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'REPLACE_FAILED';
    console.error(message.replaceAll(process.env.MONIGONES_DEMO_SECRET_KEY || '\0', '[REDACTED]'));
    process.exitCode = 1;
  });
