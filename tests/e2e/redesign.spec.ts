import { test, expect, type Page, type TestInfo, webkit, devices } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GameState } from '../../shared/types';
import { BUILDINGS } from '../../shared/config';
async function login(page: Page) {
  await page.request.post('/api/demo', { data: { userId: 'demo1' } });
  await page.goto('/city');
  await expect(page.getByRole('heading', { name: 'Ciudad deportiva' })).toBeVisible();
}
async function snapshot(page: Page, options: Parameters<Page['screenshot']>[0]) {
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('.route-loading')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
    const sources = [
      ...new Set(
        [...document.querySelectorAll('svg image')]
          .map((el) => el.getAttribute('href'))
          .filter(Boolean),
      ),
    ];
    await Promise.all(
      sources.map(async (src) => {
        const image = new Image();
        image.src = src!;
        await image.decode();
      }),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  return page.screenshot(options);
}
function fixture(info: TestInfo, mutate: (s: GameState) => void) {
  const path = info.config.metadata.testDatabase as string;
  if (!path.startsWith('/tmp/crown-e2e-'))
    throw Error('Se prohíbe modificar una base que no sea de pruebas.');
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000;BEGIN IMMEDIATE');
  try {
    const row = db.prepare('SELECT id,state FROM leagues LIMIT 1').get() as {
        id: string;
        state: string;
      },
      s = JSON.parse(row.state);
    mutate(s);
    db.prepare('UPDATE leagues SET state=?,version=version+1 WHERE id=?').run(
      JSON.stringify(s),
      row.id,
    );
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}
const root = 'docs/screenshots/v03/regressions';
test('cámara: zoom, arrastre sin abrir edificios, teclado y selección táctil', async ({ page }) => {
  await login(page);
  const map = page.getByRole('region', { name: /Mapa de la ciudad/ });
  await expect(page.locator('.map-building')).toHaveCount(15);
  const z = Number(await map.getAttribute('data-zoom'));
  await map.focus();
  await page.keyboard.press('+');
  expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(z);
  await page.keyboard.press('-');
  const old = await page.locator('.city-world').getAttribute('style');
  const b = (await map.boundingBox())!;
  await page.mouse.move(b.x + 180, b.y + 190);
  await page.mouse.down();
  await page.mouse.move(b.x + 90, b.y + 340, { steps: 8 });
  await page.mouse.up();
  await expect(page).toHaveURL(/city/);
  expect(await page.locator('.city-world').getAttribute('style')).not.toBe(old);
  await map.focus();
  await page.keyboard.press('+');
  expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(z);
  await page.keyboard.press('Home');
  await page.getByRole('link', { name: /Estadio del club, nivel/ }).tap();
  await expect(page).toHaveURL(/building\/stadium/);
});
test('pellizco con dos dedos conserva el mapa y cambia su escala', async ({ page }) => {
  await login(page);
  const map = page.locator('.city-map'),
    box = (await map.boundingBox())!,
    cdp = await page.context().newCDPSession(page),
    y = box.y + 250,
    z = Number(await map.getAttribute('data-zoom'));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 130, y, id: 1 },
      { x: 240, y, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 80, y: y - 30, id: 1 },
      { x: 290, y: y + 30, id: 2 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(z);
  await expect(page).toHaveURL(/city/);
});
test('cinco niveles de arquitectura, estadio e instalaciones ilustradas', async ({
  page,
}, info) => {
  await login(page);
  for (const level of [1, 3, 5]) {
    fixture(info, (s) => {
      const c = s.clubs.find((c) => c.userId === 'demo1')!;
      for (const b of BUILDINGS.filter((b) => b.max)) c.buildings[b.id] = level;
      s.jobs = s.jobs.filter((j) => j.clubId !== c.id);
    });
    await page.goto('/city');
    await expect(page.locator('.map-building[data-building="hq"]')).toHaveAttribute(
      'data-level',
      String(level),
    );
    await snapshot(page, { path: `${root}/ciudad-nivel-${level}.png`, scale: 'css' });
    await page.goto('/building/stadium');
    await expect(page.locator('.building-showcase [data-building="stadium"]')).toHaveAttribute(
      'data-level',
      String(level),
    );
    await snapshot(page, {
      path: `${root}/estadio-nivel-${level}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
  await expect(page.locator('.facility-tile')).toHaveCount(12);
  await page.getByRole('button', { name: /Gradas Nv/ }).click();
  await expect(page.getByRole('dialog', { name: 'Gradas' })).toBeVisible();
  await snapshot(page, { path: `${root}/instalacion-gradas.png`, fullPage: true, scale: 'css' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('obras reales: animación de construcción y evolución persistente', async ({ page }, info) => {
  await login(page);
  fixture(info, (s) => {
    const c = s.clubs.find((c) => c.userId === 'demo1')!;
    for (const b of BUILDINGS.filter((b) => b.max)) c.buildings[b.id] = 1;
    c.resources.money = 10_000_000_000;
    s.jobs = s.jobs.filter((j) => j.clubId !== c.id);
  });
  await page.goto('/building/hq');
  await page.getByRole('button', { name: 'Comenzar ampliación' }).click();
  await expect(page.getByText('Ampliación en curso')).toBeVisible();
  await page.goto('/city');
  await expect(page.locator('[data-building="hq"]')).toHaveClass(/has-job/);
  await snapshot(page, { path: `${root}/construccion-ciudad.png`, scale: 'css' });
  await page.goto('/building/hq');
  await snapshot(page, { path: `${root}/detalle-construccion.png`, fullPage: true, scale: 'css' });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Terminar obras e investigación' }).click();
  await page.goto('/city');
  await expect(page.locator('[data-building="hq"]')).toHaveAttribute('data-level', '2');
  await page.reload();
  await expect(page.locator('[data-building="hq"]')).toHaveAttribute('data-level', '2');
});
test('jornada: ambiente normal, inicio real, once, banquillo y cierre', async ({ page }) => {
  test.setTimeout(90000);
  await login(page);
  await expect(page.locator('.city-map')).toHaveAttribute('data-environment', 'normal');
  await snapshot(page, { path: `${root}/estadio-dia-normal.png`, scale: 'css' });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Iniciar jornada', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tiempo avanzado');
  await page.goto('/city');
  await expect(page.locator('.city-map')).toHaveAttribute('data-environment', 'matchday');
  await expect(page.locator('.building-live')).toHaveText(/EN JUEGO/);
  await snapshot(page, { path: `${root}/estadio-dia-partido.png`, scale: 'css' });
  await page.goto('/matchday');
  await expect(page.locator('.matchday-stage')).toHaveAttribute('data-match-status', 'live');
  await expect(page.locator('.matchday-cards .sports-card')).toHaveCount(11);
  await snapshot(page, {
    path: `${root}/convocatoria-en-juego.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Cerrar jornada', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tiempo avanzado');
  await page.goto('/matchday');
  await page.getByRole('combobox').first().click();
  await page.getByRole('option').filter({ hasText: 'Liquidada' }).first().click();
  await expect(page.getByRole('heading', { name: 'Los puntos, explicados' })).toBeVisible();
  await snapshot(page, {
    path: `${root}/informe-final-jornada.png`,
    fullPage: true,
    scale: 'css',
  });
  await page.goto('/city');
  await expect(page.locator('.city-map')).toHaveAttribute('data-environment', 'normal');
});
test('fotografías, emblemas asociados, cartas y alternativa ante error de red', async ({
  page,
}) => {
  await login(page);
  for (const id of [
    'madrid-13',
    'madrid-8',
    'madrid-14',
    'barcelona-17',
    'barcelona-10',
    'athletic-0',
    'athletic-4',
  ]) {
    await page.goto('/player/' + id);
    const img = page.locator('.sports-card .player-avatar img');
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth >= 250))
      .toBe(true);
    await expect(page.locator('.sports-card .real-club-badge')).toHaveAttribute(
      'aria-label',
      new RegExp(
        id.startsWith('madrid')
          ? 'Real Madrid'
          : id.startsWith('athletic')
            ? 'Athletic Club'
            : 'FC Barcelona',
      ),
    );
  }
  await page.goto('/player/madrid-13');
  await snapshot(page, { path: `${root}/ficha-mbappe.png`, fullPage: true, scale: 'css' });
  await page.route('**/assets/futbol/jugadores/realmadrid-mbappe.png*', (route) => route.abort());
  await page.reload();
  await expect(page.locator('.sports-card [data-asset-state="fallback"]')).toBeVisible();
  await expect(page.locator('.sports-card .player-avatar img')).toHaveAttribute(
    'src',
    '/assets/futbol/fallback/jugador.png',
  );
  await snapshot(page, { path: `${root}/retrato-alternativo.png`, fullPage: true, scale: 'css' });
});
test('investigaciones por capítulos: tres árboles, ramas y dependencias', async ({ page }) => {
  await login(page);
  await page.goto('/research');
  for (const name of ['Finanzas', 'Competición', 'Relaciones']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.research-branch-head button')).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await page.locator('.research-branch-head button').nth(i).click();
      expect(await page.locator('.research-node').count()).toBeGreaterThan(0);
    }
  }
  await page.locator('.research-node').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Requisitos y dependencias')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('audio: gesto, efectos, silencio, preferencias persistentes y movimiento reducido', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__tones = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      (window as any).__tones++;
      return original.call(this);
    };
  });
  await login(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Probar efectos' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__tones)).toBeGreaterThan(0);
  await page.getByLabel('Efectos sonoros').uncheck();
  const n = await page.evaluate(() => (window as any).__tones);
  await page.getByRole('button', { name: 'Probar efectos' }).click();
  expect(await page.evaluate(() => (window as any).__tones)).toBe(n);
  await page.getByLabel('Música ambiental').check();
  await page.getByLabel('Volumen', { exact: true }).fill('20');
  await page.getByRole('combobox', { name: 'Calidad gráfica' }).click();
  await page.getByRole('option', { name: /Baja/ }).click();
  await page.getByLabel('Animaciones ambientales').uncheck();
  await page.reload();
  await expect(page.getByLabel('Música ambiental')).toBeChecked();
  await expect(page.getByLabel('Efectos sonoros')).not.toBeChecked();
  await expect(page.getByLabel('Volumen', { exact: true })).toHaveValue('20');
  await expect(page.getByRole('combobox', { name: 'Calidad gráfica' })).toContainText('Baja');
  await page.goto('/city');
  await expect(page.locator('.ambient-layer')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.city-map')).toHaveAttribute('data-animated', 'false');
});
test('auditoría de todas las rutas, imágenes sin romper y vertical en móvil y escritorio', async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto('/');
  await snapshot(page, { path: `${root}/acceso.png`, fullPage: true, scale: 'css' });
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
  await snapshot(page, { path: `${root}/registro.png`, fullPage: true, scale: 'css' });
  await login(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const routes = [
    'city',
    ...BUILDINGS.map((b) => 'building/' + b.id),
    'market',
    'player/madrid-13',
    'draft',
    'squad',
    'matchday',
    'research',
    'concerts',
    'institution',
    'newspaper',
    'finance',
    'league',
    'marketing',
    'daily',
    'academy',
    'training',
    'fans',
    'coaches',
    'events',
    'museum',
    'archive',
    'bonuses',
    'trades',
    'more',
    'settings',
    'chat',
    'media',
  ];
  const report = [];
  for (const route of routes) {
    await page.goto('/' + route);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.evaluate(() =>
      Promise.all([...document.images].map((img) => img.decode().catch(() => null))),
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      route,
    ).toBe(true);
    expect(
      await page.evaluate(() =>
        [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
      ),
      route,
    ).toEqual([]);
    await snapshot(page, {
      path: `${root}/routes/${route.replaceAll('/', '-')}.png`,
      fullPage: true,
      scale: 'css',
    });
    report.push({
      route: '/' + route,
      screenshot: `routes/${route.replaceAll('/', '-')}.png`,
      javascriptErrors: 0,
      overflow: false,
    });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/city');
  await expect(page.locator('.phone-shell')).toHaveCSS('max-width', '460px');
  await snapshot(page, { path: `${root}/ciudad-desktop.png`, fullPage: true, scale: 'css' });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/market');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  mkdirSync(root, { recursive: true });
  writeFileSync(`${root}/route-coverage.json`, JSON.stringify(report, null, 2));
});
test('Safari WebKit y Chrome Android: acceso, ciudad, cámara y fotos', async ({ browser }) => {
  test.setTimeout(90000);
  const engine = await webkit.launch();
  try {
    const context = await engine.newContext({
        ...devices['iPhone 13'],
        baseURL: 'http://127.0.0.1:5174',
      }),
      page = await context.newPage();
    await login(page);
    await page.locator('.city-map').focus();
    await page.keyboard.press('+');
    expect(Number(await page.locator('.city-map').getAttribute('data-zoom'))).toBeGreaterThan(0.43);
    await page.goto('/player/madrid-13');
    await expect(page.locator('.sports-card .player-avatar img')).toBeVisible();
    await snapshot(page, { path: `${root}/safari-webkit.png`, fullPage: true, scale: 'css' });
    await context.close();
  } finally {
    await engine.close();
  }
  const android = await browser.newContext({
    ...devices['Pixel 5'],
    baseURL: 'http://127.0.0.1:5174',
  });
  try {
    const page = await android.newPage();
    await login(page);
    await page.locator('.city-map').focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('-');
    expect(
      Number(await page.locator('.city-map').getAttribute('data-zoom')),
    ).toBeGreaterThanOrEqual(0.27);
    await snapshot(page, { path: `${root}/chrome-android.png`, fullPage: true, scale: 'css' });
  } finally {
    await android.close();
  }
});
test('patrocinio y concierto conservan contratos reales y su ambiente', async ({ page }, info) => {
  await login(page);
  fixture(info, (s) => {
    const c = s.clubs.find((c) => c.userId === 'demo1')!;
    c.buildings.stadium = 5;
    c.modules = [...new Set([...c.modules, 'concerts'])];
    c.resources.money = 10_000_000_000;
    s.sponsors = s.sponsors.filter((d) => d.clubId !== c.id);
    s.concerts = s.concerts.filter((d) => d.clubId !== c.id);
  });
  await page.goto('/marketing');
  await page.getByRole('button', { name: 'Firmar acuerdo', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('Contrato publicitario firmado');
  let data = await (await page.request.get('/api/state')).json();
  expect(data.state.sponsors.some((s: any) => s.clubId === data.clubId)).toBe(true);
  await snapshot(page, { path: `${root}/patrocinio-firmado.png`, fullPage: true, scale: 'css' });
  await page.goto('/concerts');
  await page.getByRole('button', { name: 'Cerrar la fecha' }).first().click();
  await expect(page.getByRole('status')).toContainText('Concierto contratado');
  data = await (await page.request.get('/api/state')).json();
  expect(data.state.concerts.some((s: any) => s.clubId === data.clubId)).toBe(true);
  await snapshot(page, { path: `${root}/concierto-contratado.png`, fullPage: true, scale: 'css' });
  await page.goto('/city');
  await expect(page.locator('.city-map')).toHaveAttribute('data-environment', 'concert');
});
