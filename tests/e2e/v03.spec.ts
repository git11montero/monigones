import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { createGame } from '../../shared/seed';
import type { GameState } from '../../shared/types';
import { playerAsset } from '../../shared/football-assets';
const root = 'docs/screenshots/v03';
function fixture(info: TestInfo, mutate: (s: GameState) => void = () => {}) {
  const path = info.config.metadata.testDatabase as string;
  if (!path.startsWith('/tmp/crown-e2e-')) throw Error('Solo bases temporales de pruebas');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT id,state FROM leagues WHERE admin_id='demo1'").get() as {
        id: string;
        state: string;
      },
      old = JSON.parse(row.state) as GameState;
    const fresh = createGame(Date.now());
    fresh.id = old.id;
    fresh.invite = old.invite;
    fresh.version = old.version + 1;
    // Keep memberships consistent with new club IDs, inside the same transaction.
    for (const c of fresh.clubs)
      db.prepare('UPDATE memberships SET club_id=? WHERE user_id=? AND league_id=?').run(
        c.id,
        c.userId,
        old.id,
      );
    mutate(fresh);
    db.prepare('UPDATE leagues SET state=?,version=? WHERE id=?').run(
      JSON.stringify(fresh),
      fresh.version,
      old.id,
    );
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  } finally {
    db.close();
  }
}
async function login(page: Page, userId = 'demo1') {
  await page.request.post('/api/demo', { data: { userId } });
  await page.goto('/city');
  await expect(page.locator('.map-building')).toHaveCount(15);
}
test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
});
test('v03: cámara sin controles ni banner, límites por rueda, teclado y arrastre', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  const map = page.locator('.city-map');
  await expect(map).toHaveAttribute('data-renderer', 'canvas-2d');
  await expect(map).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.map-controls, .city-command, .department-scene')).toHaveCount(0);
  await expect(page.getByText('Tu club. Tu afición.', { exact: true })).toHaveCount(0);
  const box = (await map.boundingBox())!;
  const valid = async () => {
    const c = await map.evaluate((el) => ({
      x: Number((el as HTMLElement).dataset.cameraX),
      y: Number((el as HTMLElement).dataset.cameraY),
      z: Number((el as HTMLElement).dataset.zoom),
      w: el.clientWidth,
      h: el.clientHeight,
    }));
    expect(c.x).toBeLessThanOrEqual(1);
    expect(c.y).toBeLessThanOrEqual(1);
    expect(c.x + 1600 * c.z).toBeGreaterThanOrEqual(c.w - 2);
    expect(c.y + 2400 * c.z).toBeGreaterThanOrEqual(c.h - 2);
  };
  await page.mouse.move(box.x + 190, box.y + 200);
  for (const delta of [-10000, 10000, -2000, 2000]) {
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(100);
    await valid();
  }
  await map.focus();
  for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
    for (let i = 0; i < 35; i++) await page.keyboard.press(key);
    await valid();
  }
  await page.mouse.move(box.x + 190, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 350, box.y + 580, { steps: 15 });
  await page.mouse.up();
  await expect(page).toHaveURL(/city/);
  await valid();
});
test('v03: sustitución manual actualiza plantilla, mercado y PWA sin editar catálogo', async ({
  page,
  browser,
}, info) => {
  test.setTimeout(90000);
  let photo = '';
  fixture(info, (s) => {
    const c = s.clubs[0],
      p = s.players.find((p) => p.id === s.contracts.find((ct) => ct.clubId === c.id)!.playerId)!;
    photo = playerAsset(p).photo;
    s.marketPlayers = [...new Set([p.id, ...s.marketPlayers])];
  });
  const file = 'public' + photo,
    original = readFileSync(file);
  const pwa = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await login(page);
    await page.goto('/squad');
    await page.getByRole('button', { name: 'Plantilla', exact: true }).click();
    const image = page.locator(`.player-avatar img[src^="${photo}"]`).first();
    await expect(image).toBeVisible();
    await page.screenshot({
      path: `${root}/squad-placeholders-390x844.png`,
      fullPage: true,
      scale: 'css',
    });
    const old = await image.getAttribute('src');
    writeFileSync(file, readFileSync('tests/fixtures/football-neutral.png'));
    await expect.poll(() => image.getAttribute('src'), { timeout: 12000 }).not.toBe(old);
    await expect(image).toHaveAttribute('data-asset-state', 'provided');
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBe(512);
    await page.screenshot({
      path: `${root}/squad-replaced-390x844.png`,
      fullPage: true,
      scale: 'css',
    });
    await page.goto('/market');
    await expect(page.locator(`img[src^="${photo}"]`).first()).toHaveAttribute(
      'data-asset-state',
      'provided',
    );

    const offline = await pwa.newPage();
    await offline.goto('http://127.0.0.1:3102');
    await offline.request.post('http://127.0.0.1:3102/api/demo', { data: { userId: 'demo1' } });
    const id = photo.split('/').pop();
    const entry = (await import('../../shared/football-assets')).FOOTBALL_ASSETS.find(
      (e) => e.fileName === id,
    )!;
    await offline.goto(`http://127.0.0.1:3102/player/${entry.playerId}`);
    await offline.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await offline.reload();
    await offline.waitForFunction(() => !!navigator.serviceWorker.controller);
    const offlineImage = offline.locator(`.sports-card .player-avatar img`);
    await expect(offlineImage).toHaveAttribute('data-asset-state', 'provided');
    await expect
      .poll(() => offlineImage.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        offline.evaluate(async () => {
          const cache = await caches.open('monigones-local-football-v3');
          return (await cache.keys()).filter((r) => r.url.includes('/jugadores/')).length;
        }),
      )
      .toBeGreaterThan(0);
    await pwa.setOffline(true);
    await offline.reload();
    await expect(offlineImage).toBeVisible();
    await expect
      .poll(() => offlineImage.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await pwa.setOffline(false);
  } finally {
    writeFileSync(file, original);
    await pwa.close();
  }
});
test('v03: chat multilínea, scroll y compositor con teclado simulado en ruta y periódico', async ({
  page,
}, info) => {
  fixture(info, (s) => {
    for (let i = 0; i < 32; i++)
      s.chat.push({
        id: `qa-${i}`,
        clubId: s.clubs[i % 2].id,
        at: s.now,
        text: `Mensaje de prueba ${i}: ` + 'Información de la jornada y del club. '.repeat(3),
      });
  });
  await login(page);
  await page.goto('/chat');
  const textarea = page.getByRole('textbox', { name: 'Mensaje a la liga' }),
    send = page.getByRole('button', { name: 'Enviar mensaje' });
  const text = 'Primera línea\nSegunda línea\nNos vemos en el estadio.';
  await textarea.fill(text);
  await page.screenshot({ path: `${root}/chat-390x844.png`, scale: 'css' });
  await textarea.focus();
  await page.setViewportSize({ width: 390, height: 460 });
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'open');
  const box = (await send.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(460);
  await expect(page.locator('.bottom-nav')).not.toBeVisible();
  await page.screenshot({
    path: `${root}/chat-keyboard-viewport-emulated-390x460.png`,
    scale: 'css',
  });
  await send.click();
  await expect(textarea).toHaveValue('');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('.chat-message p').filter({ hasText: text })).toHaveCount(1);
  expect(
    await page.locator('.chat-messages').evaluate((el) => el.scrollHeight > el.clientHeight),
  ).toBe(true);
  await page.goto('/newspaper');
  await page.getByRole('button', { name: /Abrir chat/ }).click();
  await expect(page.getByRole('dialog', { name: 'Chat de la liga' })).toBeVisible();
  await textarea.fill('Borrador del periódico');
  await page.getByRole('button', { name: 'Cerrar chat' }).click();
  await page.getByRole('button', { name: /Abrir chat/ }).click();
  await expect(textarea).toHaveValue('Borrador del periódico');
  await page.screenshot({ path: `${root}/chat-newspaper-390x844.png`, scale: 'css' });
  await textarea.focus();
  await page.setViewportSize({ width: 390, height: 460 });
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'open');
  const embeddedButton = (await send.boundingBox())!;
  expect(embeddedButton.y + embeddedButton.height).toBeLessThanOrEqual(460);
  await page.screenshot({
    path: `${root}/chat-newspaper-keyboard-emulated-390x460.png`,
    scale: 'css',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await textarea.fill('');
});
