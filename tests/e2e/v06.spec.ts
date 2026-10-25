import { test, expect, type Page, type TestInfo, webkit } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame } from '../../shared/seed';
import { MODULES } from '../../shared/config';
import type { GameState } from '../../shared/types';
const root = 'docs/screenshots/v06';
function fixture(info: TestInfo) {
  const path = info.config.metadata.testDatabase as string;
  if (!path.startsWith('/tmp/crown-e2e-')) throw Error('Solo partidas desechables');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT id,state FROM leagues WHERE admin_id='demo1'").get() as {
      id: string;
      state: string;
    };
    const before = JSON.parse(row.state) as GameState,
      state = createGame(Date.now());
    state.id = before.id;
    state.invite = before.invite;
    state.version = before.version + 1;
    for (const c of state.clubs)
      db.prepare('UPDATE memberships SET club_id=? WHERE user_id=? AND league_id=?').run(
        c.id,
        c.userId,
        state.id,
      );
    for (const c of state.clubs.slice(0, 2)) {
      c.facilities.pitch = 4;
      c.modules = MODULES.map((m) => m.id);
    }
    state.clubs[0].selection.starters.forEach((p, i) => {
      p.quality = i % 4;
      p.unlockedQuality = i % 4;
    });
    db.prepare('UPDATE leagues SET state=?,version=? WHERE id=?').run(
      JSON.stringify(state),
      state.version,
      state.id,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}
async function login(page: Page, userId = 'demo1') {
  expect((await page.request.post('/api/demo', { data: { userId } })).ok()).toBe(true);
  await page.goto('/city');
  await expect(page.locator('.map-building')).toHaveCount(15);
}
async function shot(page: Page, name: string) {
  mkdirSync(root, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${root}/${name}.png`, scale: 'css', animations: 'disabled' });
}
test('v06: barra estable, cabecera, WebP, mapa estático y ayuda en cinco tamaños', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  fixture(info);
  await login(page);
  const report = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    let baseline: { y: number; height: number } | null = null;
    for (const route of ['city', 'squad', 'market', 'league', 'more']) {
      await page.goto('/' + route);
      await expect(page.locator('.app-header')).toBeVisible();
      await expect(page.locator('.app-header .club-identity')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Abrir chat de la liga' })).toBeVisible();
      const nav = await page.locator('.bottom-nav').boundingBox();
      expect(nav).toBeTruthy();
      if (!baseline) baseline = nav;
      expect(nav!.y).toBeCloseTo(baseline!.y, 0);
      expect(nav!.height).toBeCloseTo(baseline!.height, 0);
      expect(nav!.y + nav!.height).toBeCloseTo(height, 0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (route === 'city') {
        await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
        await expect(page.locator('.city-map')).toHaveAttribute('data-ambient-actors', '0');
        await expect(page.locator('.city-map')).toHaveAttribute('data-animated', 'false');
      }
      await shot(page, `${route}-${width}x${height}`);
      report.push({ route, width, height, nav });
    }
    await page.goto('/training');
    await page.getByRole('button', { name: 'Ayuda: Casillas persistentes' }).first().click();
    const help = page.getByRole('dialog');
    await expect(help).toContainText('once casillas');
    await shot(page, `ayuda-${width}x${height}`);
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await page.goto('/building/offices');
    await expect(page.locator('.module-card')).toHaveCount(9);
    for (const card of await page.locator('.module-card').all())
      await expect(card.getByRole('link')).toHaveCount(1);
    await shot(page, `oficinas-${width}x${height}`);
  }
  await page.goto('/market');
  await expect(page.locator('img[src*="/escudos/"][src*=".webp"]').first()).toBeVisible();
  expect(errors).toEqual([]);
  mkdirSync('docs/validation/v06', { recursive: true });
  writeFileSync('docs/validation/v06/navigation.json', JSON.stringify(report, null, 2));
});
test('v06: consultar formaciones no cambia convocatoria ni mejoras y ofertas conservan entrada', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  const before = await (await page.request.get('/api/state')).json();
  const c = before.state.clubs.find((c: any) => c.id === before.clubId);
  await page.goto('/training');
  for (const formation of ['3-3-4', '4-2-3-1', '4-4-2']) {
    await page.getByRole('combobox', { name: 'Formación de entrenamiento' }).click();
    await page.getByRole('option', { name: new RegExp('^' + formation + ' ') }).click();
    await expect(page.locator('.training-tactical-board')).toHaveAttribute(
      'data-formation',
      formation,
    );
    await expect(page.locator('.training-slot-dot')).toHaveCount(11);
    await expect(page.locator('.training-slot-card')).toHaveCount(11);
  }
  const after = await (await page.request.get('/api/state')).json();
  expect(after.state.clubs.find((p: any) => p.id === c.id).selection).toEqual(c.selection);
  await shot(page, 'entrenamiento-390x844');
  await page.locator('.quality-legend').evaluate((el) => el.scrollIntoView({block:'center',behavior:'instant'}));
  await shot(page, 'calidades-390x844');
  const free = before.state.players.find((p: any) => before.state.marketPlayers.includes(p.id));
  await page.goto('/player/' + free.id);
  const input = page.locator('.money-field input').first();
  await input.fill('');
  await page.getByRole('button', { name: /Enviar oferta secreta/ }).click();
  await expect(page.locator('.field-error')).toContainText('Indica');
  await input.fill('letras');
  await page.getByRole('button', { name: /Enviar oferta secreta/ }).click();
  await expect(input).toHaveValue('letras');
  await expect(page.locator('.field-error')).toContainText('numérico');
  await input.fill('1');
  await page.getByRole('button', { name: /Enviar oferta secreta/ }).click();
  await expect(page.locator('.field-error')).toContainText('mínima');
  await shot(page, 'oferta-error-390x844');
});
test('v06: chat compartido entre dos presidentes, borrador y contexto conservados', async ({
  page,
  browser,
}, info) => {
  fixture(info);
  await login(page);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    other = await context.newPage();
  try {
    await login(other, 'demo2');
    await page.goto('/training');
    await page.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    const dialog = page.getByRole('dialog', { name: 'Chat de la liga' });
    await dialog.locator('textarea').fill('Borrador conservado');
    await page.getByRole('button', { name: 'Cerrar chat' }).click();
    await expect(page).toHaveURL(/training/);
    await page.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    await expect(dialog.locator('textarea')).toHaveValue('Borrador conservado');
    await dialog.locator('textarea').fill('Mensaje v06 entre presidentes');
    await dialog.getByRole('button', { name: 'Enviar mensaje' }).click();
    await other.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    await expect(other.getByRole('dialog')).toContainText('Mensaje v06 entre presidentes');
    await shot(page, 'chat-global-390x844');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/training/);
  } finally {
    await context.close();
  }
});
test('v06: WebKit y Chromium bloquean gestos exteriores sin bloquear el mapa ni texto de 16px', async ({
  page,
}, info) => {
  fixture(info);
  const safari = await webkit.launch(),
    context = await safari.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    ios = await context.newPage();
  try {
    for (const p of [page, ios]) {
      await login(p);
      await p.goto('/market');
      await expect(p.locator('.app-header')).toBeVisible();
      const result = await p.evaluate(() => {
        const h = document.querySelector('.app-header')!,
          e = new Event('gesturestart', { bubbles: true, cancelable: true });
        h.dispatchEvent(e);
        const touch = new Event('touchmove', { bubbles: true, cancelable: true });
        Object.defineProperty(touch, 'touches', { value: [{}, {}] });
        h.dispatchEvent(touch);
        return {
          gesture: e.defaultPrevented,
          multi: touch.defaultPrevented,
          meta: document.querySelector('meta[name="viewport"]')?.getAttribute('content'),
        };
      });
      expect(result.gesture).toBe(true);
      expect(result.multi).toBe(true);
      expect(result.meta).not.toContain('user-scalable=no');
      await p.goto('/city');
      await expect(p.locator('.city-map')).toHaveAttribute('data-ready', 'true');
      const map = await p.locator('.city-map').evaluate((el) => {
        const e = new Event('gesturestart', { bubbles: true, cancelable: true });
        el.dispatchEvent(e);
        return e.defaultPrevented;
      });
      expect(map).toBe(false);
      await p.goto('/chat');
      expect(
        await p.locator('textarea').evaluate((e) => parseFloat(getComputedStyle(e).fontSize)),
      ).toBeGreaterThanOrEqual(16);
    }
  } finally {
    await context.close();
    await safari.close();
  }
});

test('v06: escudos recuperan WebP, PNG compatible y neutral sin imágenes ocultas', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  await page.route('**/assets/futbol/escudos/athletic.webp*', (route) => route.abort());
  await page.goto('/player/athletic-0');
  const image = page.locator('.sports-card .real-club-badge img');
  await expect(image).toHaveAttribute('src', /escudos\/athletic\.png/);
  await page.route('**/assets/futbol/escudos/athletic.png*', (route) => route.abort());
  await page.reload();
  await expect(image).toHaveAttribute('src', /fallback\/escudo\.png/);
  await page.route('**/assets/futbol/fallback/escudo.png*', (route) => route.abort());
  await page.reload();
  await expect(image).toHaveAttribute('src', /^data:image\/svg/);
  await expect(image).toBeVisible();
  await page.unroute('**/assets/futbol/escudos/athletic.webp*');
  await page.reload();
  await expect(image).toHaveAttribute('src', /escudos\/athletic\.webp/);
});
