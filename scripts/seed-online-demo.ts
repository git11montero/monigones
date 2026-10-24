import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { SupabaseRpc } from '../server/online/transport.js';
import { DemoService } from '../server/demo/service.js';
import {
  configSchema,
  generatedDemo,
  readSnapshot,
  snapshotOf,
  type DemoConfig,
} from '../server/demo/state.js';
import { invariant } from '../shared/math.js';

export function validateTarget(config: DemoConfig, rawUrl: string, secret: string) {
  const url = new URL(rawUrl);
  invariant(
    !url.username && !url.password && !url.search && !url.hash && url.pathname === '/',
    'URL Supabase inválida.',
  );
  if (config.environment === 'local')
    invariant(
      config.projectRef === 'local' &&
        ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
        ['http:', 'https:'].includes(url.protocol),
      'El entorno local requiere loopback.',
    );
  else
    invariant(
      config.projectRef !== 'local' &&
        url.protocol === 'https:' &&
        !url.port &&
        url.hostname === `${config.projectRef}.supabase.co`,
      'El projectRef no coincide con la URL Supabase.',
    );
  let role = '';
  try {
    role = JSON.parse(Buffer.from(secret.split('.')[1] || '', 'base64url').toString()).role;
  } catch {
    /* New opaque keys are not JWTs. */
  }
  invariant(
    secret.startsWith('sb_secret_') || role === 'service_role',
    'Se necesita una clave privada de servidor; nunca una publishable/anon.',
  );
  return url.origin;
}
export async function main(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string' },
      'env-file': { type: 'string' },
      'dry-run': { type: 'boolean' },
      apply: { type: 'boolean' },
      status: { type: 'boolean' },
      verify: { type: 'boolean' },
      'bind-users': { type: 'boolean' },
      help: { type: 'boolean' },
    },
    strict: true,
  });
  if (values.help || !args.length) {
    console.log(
      'seed:online-demo --config ARCHIVO --dry-run | --apply | --status | --verify [--bind-users] [--env-file ARCHIVO]\nSin --apply no se escribe. --apply exige TTY y confirmación del proyecto y la liga.',
    );
    return;
  }
  invariant(
    [values['dry-run'], values.apply, values.status, values.verify].filter(Boolean).length === 1,
    'Elige exactamente una acción.',
  );
  invariant(values.config, 'Falta --config.');
  if (values['env-file']) process.loadEnvFile(values['env-file']);
  const file = resolve(values.config),
    config = configSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const url = validateTarget(
    config,
    process.env.MONIGONES_DEMO_SUPABASE_URL || '',
    process.env.MONIGONES_DEMO_SECRET_KEY || '',
  );
  const secret = process.env.MONIGONES_DEMO_SECRET_KEY!;
  const client = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = new DemoService(new SupabaseRpc(url, secret), async (id) => {
    const { data, error } = await client.auth.admin.getUserById(id);
    invariant(
      !error &&
        data.user?.id === id &&
        !data.user.deleted_at &&
        (!data.user.banned_until || Date.parse(data.user.banned_until) <= Date.now()),
      'DEMO_AUTH_USER_MISSING_OR_DISABLED',
    );
  });
  if (values.status) {
    console.log(JSON.stringify(await service.status(config.leagueId), null, 2));
    return;
  }
  const source = config.snapshot
    ? readSnapshot(JSON.parse(readFileSync(resolve(dirname(file), config.snapshot), 'utf8')))
    : snapshotOf(
        generatedDemo(config.mode, Date.parse(config.sourceAt!), config.seed),
        'generated-local-demo',
      );
  const preview = await service.preview(config, source, values['bind-users']);
  console.log(
    JSON.stringify(
      {
        environment: config.environment,
        project: config.projectRef,
        action: values['bind-users'] ? 'bind' : 'create',
        problems: preview.problems,
        existing: preview.status.demo,
        plan: preview.report,
      },
      null,
      2,
    ),
  );
  if (values['dry-run']) {
    invariant(!preview.problems.length, preview.problems.join(', '));
    return;
  }
  if (values.verify) {
    console.log(JSON.stringify(await service.verify(config, preview.plan), null, 2));
    return;
  }
  invariant(!preview.problems.length, preview.problems.join(', '));
  invariant(
    process.stdin.isTTY && process.stdout.isTTY,
    '--apply requiere una terminal interactiva; no admite --yes ni confirmación por defecto.',
  );
  const phrase = `${values['bind-users'] ? 'ASOCIAR' : 'CARGAR'} ${config.projectRef} ${config.leagueId}`;
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    invariant(
      (await terminal.question(`Escribe exactamente «${phrase}» para confirmar: `)).trim() ===
        phrase,
      'Operación cancelada.',
    );
  } finally {
    terminal.close();
  }
  const result = await service.apply(config, source, values['bind-users']);
  console.log(JSON.stringify(result, null, 2));
  const after = await service.preview(config, source, true);
  console.log(JSON.stringify(await service.verify(config, after.plan), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((error: unknown) => {
    // Do not print SDK objects, headers, raw payloads, SQL details or credentials.
    const message = error instanceof Error ? error.message : 'Error desconocido.';
    const safe = message.replaceAll(process.env.MONIGONES_DEMO_SECRET_KEY || '\0', '[REDACTED]');
    console.error(safe);
    process.exitCode = 1;
  });
