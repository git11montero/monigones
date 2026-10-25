import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createGame } from '../../shared/seed';
import { FORMATION_CATALOG } from '../../shared/formations';
import { BUILDINGS } from '../../shared/config';
import { execute } from '../../shared/engine';
import type { GameState } from '../../shared/types';
const root = 'docs/screenshots/v05';
function fixture(info: TestInfo, change: (state: GameState) => void = () => {}) {
  const path = info.config.metadata.testDatabase as string;
  if (!path.startsWith('/tmp/crown-e2e-')) throw Error('Solo partidas desechables de pruebas');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
  try {
    const row = db.prepare("SELECT id,state FROM leagues WHERE admin_id='demo1'").get() as {
      id: string;
      state: string;
    };
    const before = JSON.parse(row.state) as GameState,
      fresh = createGame(Date.now());
    fresh.id = before.id;
    fresh.invite = before.invite;
    fresh.version = before.version + 1;
    for (const c of fresh.clubs)
      db.prepare('UPDATE memberships SET club_id=? WHERE user_id=? AND league_id=?').run(
        c.id,
        c.userId,
        fresh.id,
      );
    change(fresh);
    db.prepare('UPDATE leagues SET state=?,version=? WHERE id=?').run(
      JSON.stringify(fresh),
      fresh.version,
      fresh.id,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}
async function login(page: Page) {
  await page.request.post('/api/demo', { data: { userId: 'demo1' } });
  await page.goto('/city');
  await expect(page.locator('.map-building')).toHaveCount(15);
}
async function command(page: Page, data: Record<string, unknown>) {
  const reply = await page.request.post('/api/command', {
    data,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(reply.ok(), await reply.text()).toBe(true);
  return reply.json();
}
async function shot(page: Page, name: string) {
  mkdirSync(root, { recursive: true });
  await expect(page.locator('.loading-screen, .route-loading, .toast')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${root}/${name}.png`,
    scale: 'css',
    fullPage: false,
    animations: 'disabled',
  });
}
test('v05: jornada previa, directa, liquidada; accesos compartidos y gestos', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  fixture(info);
  await login(page);
  await expect(page.locator('.city-match-dock')).toHaveCount(0);
  const toggle = page.getByRole('button', { name: 'Jornada 1 · Previa', exact: true });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  const time = await toggle.locator('span').textContent();
  await expect.poll(() => toggle.locator('span').textContent(), { timeout: 2500 }).not.toBe(time);
  await toggle.click();
  const detail = page.getByRole('region', { name: 'Detalle de jornada 1' });
  await expect(detail).toContainText('11/11 titulares');
  await expect(detail).toContainText('Coste previsto');
  await shot(page, 'jornada-previa-abierta-390x844');
  await page.keyboard.press('Escape');
  await expect(detail).toHaveCount(0);
  await toggle.click();
  const map = page.locator('.city-map'),
    box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 100);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height - 130);
  await page.mouse.up();
  await expect(detail).toHaveCount(0);
  await expect(page.locator('.city-map')).toBeVisible();
  const labels = await page.locator('.city-shortcuts').innerText();
  await page.getByRole('button', { name: 'Secciones', exact: true }).click();
  expect(await page.locator('.city-shortcuts').innerText()).toBe(labels);
  await page.locator('.city-content').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const last = page.locator('.city-section-access').last();
  await expect(last).toBeInViewport();
  const footer = (await page.locator('.city-shortcuts').boundingBox())!,
    lastBox = (await last.boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(footer.y);
  await page.getByRole('button', { name: /Obras/ }).click();
  await expect(page.getByRole('region', { name: 'Obras de tu club' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar construcciones' }).click();
  await page.getByRole('link', { name: 'Actividades y recompensas' }).click();
  await expect(page).toHaveURL(/\/daily$/);
  await page.goto('/city');
  await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  await command(page, { type: 'advance', step: 'kickoff' });
  await page.reload();
  const live = page.getByRole('button', { name: 'Jornada 1 · En curso', exact: true });
  await expect(live).toBeVisible();
  await live.click();
  await expect(detail).toContainText('Puntos base provisionales');
  await expect(detail).toContainText('Cambios restantes');
  await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
  await shot(page, 'jornada-activa-390x844');
  await detail.getByRole('link', { name: /Seguimiento completo/ }).click();
  await expect(page.getByRole('heading', { name: 'Jornada 1', exact: true })).toBeVisible();
  await command(page, { type: 'advance', step: 'round' });
  await page.goto('/city');
  await page.getByRole('button', { name: 'Jornada 1 · Finalizada', exact: true }).click();
  await expect(detail).toContainText('Resultado fantasy');
  await expect(detail).toContainText('Televisión');
  await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
  await shot(page, 'jornada-finalizada-390x844');
  await detail.getByRole('link', { name: 'Abrir informe' }).click();
  await expect(page.getByRole('heading', { name: 'Jornada 1', exact: true })).toBeVisible();
});
test('v05: selector táctico: vista previa, bloqueo, filas reales, servidor y recarga', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  fixture(info, (state) => {
    const club = state.clubs[0];
    execute(
      state,
      { userId: club.userId, clubId: club.id, admin: true },
      { type: 'formation', formation: '4-4-2' },
    );
    club.facilities.pitch = 0;
  });
  await login(page);
  await page.goto('/squad');
  await page.getByRole('button', { name: 'Formación 4-4-2', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Tu dibujo táctico' });
  await expect(dialog.locator('.formation-choice')).toHaveCount(14);
  await dialog.locator('.formation-choice').filter({ hasText: '3-3-4' }).click();
  await expect(dialog.getByRole('button', { name: 'Requiere césped nivel 4' })).toBeDisabled();
  await expect(dialog.locator('.tactical-row i')).toHaveCount(11);
  await shot(page, 'formacion-bloqueada-390x844');
  const forged = await page.request.post('/api/command', {
    data: { type: 'formation', formation: '3-4-4' },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(forged.status()).toBe(400);
  await dialog.locator('.formation-choice').filter({ hasText: '4-3-3' }).click();
  await dialog.getByRole('button', { name: 'Aplicar 4-3-3' }).click();
  await expect(page.locator('.football-pitch')).toHaveAttribute('data-formation', '4-3-3');
  await expect(page.locator('.pitch-player')).toHaveCount(11);
  await page.reload();
  await expect(page.locator('.football-pitch')).toHaveAttribute('data-formation', '4-3-3');
  await shot(page, 'formacion-inicial-4-3-3-390x844');
  fixture(info, (state) => {
    state.clubs[0].facilities.pitch = 4;
  });
  await page.reload();
  for (const f of FORMATION_CATALOG) {
    await page.getByRole('button', { name: /^Formación / }).click();
    await page.locator('.formation-choice').filter({ hasText: f.id }).click();
    await expect(page.locator('.tactical-row i')).toHaveCount(11);
    if (f.id !== (await page.locator('.football-pitch').getAttribute('data-formation')))
      await page.getByRole('button', { name: `Aplicar ${f.id}`, exact: true }).click();
    else await page.getByRole('button', { name: 'Cerrar selector táctico' }).click();
    await expect(page.locator('.football-pitch')).toHaveAttribute('data-formation', f.id);
    await expect(page.locator('.pitch-player')).toHaveCount(11);
    expect(
      await page
        .locator('.pitch-row')
        .evaluateAll((rows) => rows.map((row) => row.children.length)),
    ).toEqual([...f.lines.map((r) => r.count).reverse(), 1]);
  }
  await page.reload();
  await expect(page.locator('.football-pitch')).toHaveAttribute('data-formation', '3-3-4');
});
test('v05: auditoría visual completa, cinco tamaños y consola sin extensiones', async ({
  page,
}, info) => {
  test.setTimeout(600000);
  fixture(info);
  mkdirSync('docs/validation/v05', { recursive: true });
  const consoleMessages: { type: string; text: string; url: string }[] = [],
    errors: string[] = [];
  page.on('console', (message) =>
    consoleMessages.push({
      type: message.type(),
      text: message.text(),
      url: message.location().url,
    }),
  );
  page.on('pageerror', (error) => errors.push(error.message));
  const sizes = [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ];
  const routes = [
    'more',
    'market',
    'squad',
    'draft',
    ...BUILDINGS.map((b) => `building/${b.id}`),
    'research',
    'finance',
    'daily',
    'events',
    'newspaper',
    'chat',
    'trades',
    'settings',
    'league',
    'matchday',
    'training',
    'fans',
    'marketing',
    'concerts',
    'academy',
    'institution',
    'museum',
    'coaches',
    'bonuses',
    'archive',
  ];
  const audited: Record<string, unknown>[] = [];
  for (const [width, height] of sizes) {
    fixture(info);
    await page.setViewportSize({ width, height });
    await page.context().clearCookies();
    await page.goto('/');
    await expect(page.locator('.auth-page')).toBeVisible();
    await shot(page, `acceso-${width}x${height}`);
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await shot(page, `registro-${width}x${height}`);
    await login(page);
    await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
    await shot(page, `ciudad-mapa-${width}x${height}`);
    const selector = (await page.locator('.city-view-switch').boundingBox())!,
      indicator = (await page.locator('.matchday-toggle').boundingBox())!;
    expect(
      selector.x + selector.width <= indicator.x + 1 ||
        selector.y + selector.height <= indicator.y + 1,
    ).toBe(true);
    await page.locator('.matchday-toggle').click();
    await expect(page.locator('.city-round-panel')).toBeVisible();
    await shot(page, `ciudad-panel-${width}x${height}`);
    await page.getByRole('button', { name: 'Cerrar detalle de jornada' }).click();
    await page.getByRole('button', { name: 'Secciones', exact: true }).click();
    await shot(page, `ciudad-secciones-${width}x${height}`);
    await page.getByRole('button', { name: /Obras/ }).click();
    await shot(page, `obras-${width}x${height}`);
    await page.getByRole('button', { name: 'Cerrar construcciones' }).click();
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
    for (const route of routes) {
      await page.goto('/' + route);
      await expect(page.locator('.app-header')).toBeVisible();
      await expect(page.locator('.interior-main h1')).toBeVisible();
      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth,
        viewport: innerWidth,
      }));
      expect(overflow.document, `${route} ${width}`).toBeLessThanOrEqual(overflow.viewport + 1);
      const shell = (await page.locator('.phone-shell').boundingBox())!;
      expect(shell.width).toBeLessThanOrEqual(460);
      await shot(page, `${route.replaceAll('/', '-')}-${width}x${height}`);
      if (route === 'squad') {
        await page.getByRole('button', { name: 'Banquillo', exact: true }).click();
        await expect(page.locator('.bench-summary')).toContainText('3/3');
        await shot(page, `banquillo-${width}x${height}`);
        await page.getByRole('button', { name: 'Alineación', exact: true }).click();
        await page.getByRole('button', { name: /^Formación / }).click();
        await page.locator('.formation-choice').filter({ hasText: '4-2-3-1' }).click();
        await shot(page, `selector-tactico-${width}x${height}`);
        const bounds = (await page.locator('.formation-modal').boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
        await page.getByRole('button', { name: 'Cerrar selector táctico' }).click();
      }
      audited.push({ route, width, height, overflow: false });
    }
  }
  expect(errors).toEqual([]);
  expect(
    consoleMessages.filter((m) =>
      /NativeMessaging|Native host has exited|console-log\.service/.test(m.text + ' ' + m.url),
    ),
  ).toEqual([]);
  expect(consoleMessages.filter((m) => m.type === 'error')).toEqual([]);
  writeFileSync(
    'docs/validation/v05/visual-audit.json',
    JSON.stringify(
      {
        audited,
        javascriptErrors: errors,
        consoleErrors: consoleMessages.filter((m) => m.type === 'error'),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    'docs/validation/v05/native-messaging.json',
    JSON.stringify(
      {
        browser: 'Playwright Chromium with extensions disabled',
        cleanProfile: true,
        reproduced: false,
        matchingMessages: [],
        originalExtensionIdentified: false,
        globalConsoleFilters: false,
      },
      null,
      2,
    ),
  );
});

test('v05: formaciones de varias líneas y seis medios legibles en cinco tamaños', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  fixture(info, (state) => {
    state.clubs[0].facilities.pitch = 4;
  });
  await login(page);
  await page.goto('/squad');
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    for (const formation of ['4-2-3-1', '3-6-1', '3-3-4']) {
      await page.getByRole('button', { name: /^Formación / }).click();
      await page.locator('.formation-choice').filter({ hasText: formation }).click();
      await expect(page.locator('.tactical-row i')).toHaveCount(11);
      await shot(page, `previa-${formation}-${width}x${height}`);
      await page.getByRole('button', { name: `Aplicar ${formation}`, exact: true }).click();
      const pitch = page.locator('.football-pitch');
      await expect(pitch).toHaveAttribute('data-formation', formation);
      await expect(pitch.locator('.pitch-player')).toHaveCount(11);
      const boxes = await pitch.locator('.pitch-player').evaluateAll((players) =>
        players.map((player) => {
          const r = player.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        }),
      );
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const x = boxes[a],
            y = boxes[b];
          expect(
            x.right <= y.left + 1 ||
              y.right <= x.left + 1 ||
              x.bottom <= y.top + 1 ||
              y.bottom <= x.top + 1,
          ).toBe(true);
        }
      await pitch.scrollIntoViewIfNeeded();
      await shot(page, `once-${formation}-${width}x${height}`);
    }
  }
});

test('v05: detalle desplazado de cartas, investigación, convocatoria y jornadas en cinco tamaños', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  fixture(info);
  await login(page);
  const sizes = [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/market');
    const card = page.locator('.sports-card.market').first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(card).toBeVisible();
    const bounds = (await card.boundingBox())!;
    expect(bounds.height).toBeLessThan(300);
    const nav = (await page.locator('.bottom-nav').boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
    await shot(page, `market-cartas-${width}x${height}`);
    await page.goto('/research');
    const research = page.locator('.research-node').first();
    await research.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const researchBounds = (await research.boundingBox())!;
    expect(researchBounds.y + researchBounds.height).toBeLessThanOrEqual(nav.y);
    await shot(page, `research-arbol-${width}x${height}`);
    await page.goto('/squad');
    await page.getByRole('button', { name: 'Plantilla', exact: true }).click();
    await shot(page, `plantilla-${width}x${height}`);
    await page.getByRole('button', { name: 'Alineación', exact: true }).click();
    await page.locator('.lineup-cost').scrollIntoViewIfNeeded();
    await shot(page, `convocatoria-${width}x${height}`);
  }
  await command(page, { type: 'advance', step: 'kickoff' });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/city');
    await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Jornada 1 · En curso', exact: true }).click();
    await shot(page, `jornada-directo-${width}x${height}`);
  }
  await command(page, { type: 'advance', step: 'round' });
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.goto('/city');
    await expect(page.locator('.city-map')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Jornada 1 · Finalizada', exact: true }).click();
    await shot(page, `jornada-final-${width}x${height}`);
  }
});

test('v05: ficha de jugador, museo rival y créditos sin desbordamiento', async ({ page }, info) => {
  test.setTimeout(120000);
  let playerId = '',
    opponentId = '';
  fixture(info, (state) => {
    playerId = state.players[0].id;
    opponentId = state.clubs[1].id;
  });
  await login(page);
  const audited = [];
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    for (const [route, label] of [
      ['media', 'creditos'],
      [`player/${playerId}`, 'ficha-jugador'],
      [`museum/${opponentId}`, 'museo-rival'],
    ]) {
      await page.goto('/' + route);
      await expect(page.locator('.interior-main h1').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      expect(overflow).toBe(false);
      await shot(page, `${label}-${width}x${height}`);
      audited.push({ route, width, height, overflow });
    }
  }
  writeFileSync('docs/validation/v05/additional-routes.json', JSON.stringify({ audited }, null, 2));
});
