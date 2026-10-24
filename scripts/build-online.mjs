import process from 'node:process';
import { execFileSync } from 'node:child_process';
try {
  process.loadEnvFile('.env.online.local');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const url = process.env.VITE_SUPABASE_URL,
  key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key)
  throw Error(
    'Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY para construir el modo online.',
  );
for (const [name, value] of Object.entries(process.env)) {
  if (!name.startsWith('VITE_') || !value) continue;
  let role = '';
  try {
    role = JSON.parse(Buffer.from(value.split('.')[1] || '', 'base64url').toString()).role || '';
  } catch {
    /* Not a JWT. */
  }
  if (
    /SECRET|SERVICE_ROLE|PASSWORD|DATABASE|CRON/i.test(name) ||
    value.startsWith('sb_secret_') ||
    role === 'service_role'
  )
    throw Error(`Una variable pública contiene una clave privada: ${name}`);
}
// The browser's Bundler resolution accepts imports that native Node ESM rejects.
// Check the entire function dependency graph with Node's resolution before building.
execFileSync('npm', ['run', 'check:online'], { stdio: 'inherit' });
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/football-manifest.ts'], {
  stdio: 'inherit',
});
const args = ['run', 'build'];
if (process.env.MONIGONES_BUILD_OUT_DIR)
  args.push('--', '--outDir', process.env.MONIGONES_BUILD_OUT_DIR, '--emptyOutDir');
execFileSync('npm', args, {
  stdio: 'inherit',
  env: { ...process.env, VITE_BACKEND: 'supabase' },
});
