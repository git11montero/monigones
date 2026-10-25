import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applySqlite, previewSqlite } from '../../server/demo/sqlite-replacement';
test('demo sustituida: la sesión conservada carga Cholo ATM y permite mercado, convocatoria y chat', async ({
  page,
}, info) => {
  const file = info.config.metadata.testDatabase as string;
  if (!file.startsWith('/tmp/crown-e2e-')) throw Error('Solo partidas temporales');
  const directory = mkdtempSync(join(tmpdir(), 'monigones-browser-replace-'));
  try {
    await page.request.post('/api/demo', { data: { userId: 'demo1' } });
    const before = await (await page.request.get('/api/state')).json();
    const operation = randomUUID();
    await applySqlite(file, directory, operation, previewSqlite(file, directory));
    const stale = await page.request.post('/api/command', {
      data: { type: 'chat', text: 'No debe publicarse' },
      headers: {
        'Idempotency-Key': randomUUID(),
        'X-Monigones-Generation': before.state.resetId || before.state.id,
      },
    });
    expect(stale.ok()).toBe(false);
    await page.goto('/city');
    await expect(page.locator('.map-building')).toHaveCount(15);
    const game = await (await page.request.get('/api/state')).json();
    expect(game.state.resetId).toBe(operation);
    expect(game.state.contracts).toHaveLength(58);
    expect((await page.request.post('/api/demo', { data: { userId: 'demo6' } })).ok()).toBe(false);
    expect(game.state.clubs.find((c: any) => c.id === game.clubId).name).toBe('Cholo ATM');
    await page.goto('/market');
    await expect(page.locator('.loading-screen,.route-loading')).toHaveCount(0);
    await page.goto('/squad');
    await expect(page.locator('.pitch-player')).toHaveCount(11);
    await page.goto('/newspaper');
    await page.locator('.newspaper-chat-toggle').click();
    const message = `Demo definitiva ${randomUUID()}`;
    await page.getByRole('textbox', { name: 'Mensaje a la liga' }).fill(message);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(page.locator('p').filter({ hasText: message })).toBeVisible();
    await page.reload();
    await page.locator('.newspaper-chat-toggle').click();
    await expect(page.locator('p').filter({ hasText: message })).toBeVisible();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
