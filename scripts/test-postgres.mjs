import process from 'node:process';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
const bin = process.env.MONIGONES_PG_BIN || '';
const executable = (name) => (bin ? join(bin, name) : name);
try {
  execFileSync(executable('postgres'), ['--version'], { stdio: 'pipe' });
} catch {
  throw Error(
    'Instala PostgreSQL 17+ y define MONIGONES_PG_BIN con su carpeta bin. Esta prueba nunca utiliza una base existente.',
  );
}
const work = mkdtempSync(join(tmpdir(), 'monigones-pg-test-')),
  data = join(work, 'data');
const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
let running = false;
try {
  const initArgs = ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale'];
  if (process.env.MONIGONES_PG_SHARE) initArgs.push('-L', process.env.MONIGONES_PG_SHARE);
  execFileSync(executable('initdb'), initArgs, { stdio: 'pipe' });
  execFileSync(
    executable('pg_ctl'),
    [
      '-D',
      data,
      '-l',
      join(work, 'postgres.log'),
      '-o',
      `-p ${port} -h 127.0.0.1 -k ${work} -c wal_level=logical`,
      'start',
    ],
    { stdio: 'pipe' },
  );
  running = true;
  const bootstrap = join(work, 'bootstrap.sql');
  writeFileSync(
    bootstrap,
    `create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;create table auth.users(id uuid primary key,email text);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
  );
  const sqlArgs = [
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ];
  const migrations = readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const files = [
    bootstrap,
    ...migrations.map((f) => 'supabase/migrations/' + f),
    'supabase/seed.sql',
  ];
  let output = '';
  for (const file of files)
    output += execFileSync(executable('psql'), [...sqlArgs, '-f', file], { encoding: 'utf8' });
  writeFileSync('docs/validation/online/migrations-executed.txt', output);
  const child = spawnSync('npx', ['vitest', 'run', '--config', 'vitest.postgres.config.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      MONIGONES_TEST_DATABASE_URL: `postgresql://postgres@127.0.0.1:${port}/postgres`,
      MONIGONES_ISOLATED_TEST: 'true',
    },
  });
  if (child.status !== 0) process.exitCode = child.status || 1;
} finally {
  if (running)
    execFileSync(executable('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], { stdio: 'pipe' });
  if (work.startsWith(join(tmpdir(), 'monigones-pg-test-')) && existsSync(work))
    rmSync(work, { recursive: true, force: true });
}
