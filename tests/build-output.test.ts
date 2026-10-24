import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
describe('el build online no publica configuración ausente o privada', () => {
  it.each([
    [{}, 'Define VITE_SUPABASE_URL'],
    [{ VITE_SUPABASE_URL: 'https://fixture.supabase.co' }, 'Define VITE_SUPABASE_URL'],
    [
      {
        VITE_SUPABASE_URL: 'https://fixture.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test_only',
      },
      'clave privada',
    ],
  ])('rechaza antes de compilar sin imprimir las credenciales (%#)', (config, message) => {
    const work = mkdtempSync(join(tmpdir(), 'monigones-build-guard-'));
    try {
      // No .env files or existing project settings are read from this disposable cwd.
      const env = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith('VITE_')),
      );
      let failure = '';
      try {
        execFileSync(process.execPath, [resolve('scripts/build-online.mjs')], {
          cwd: work,
          env: { ...env, ...config },
          stdio: 'pipe',
        });
      } catch (error) {
        failure = String((error as { stderr: Buffer }).stderr);
      }
      expect(failure).toContain(message);
      expect(failure).not.toContain('sb_secret_test_only');
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
