import { test, expect } from '@playwright/test';
async function login(page: import('@playwright/test').Page, userId = 'demo1') {
  await page.request.post('/api/demo', { data: { userId } });
  await page.goto('/city');
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
}
test('acceso, ciudad vertical, navegación y ausencia de desbordamiento', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Tu club/ })).toBeVisible();
  await page.getByRole('button', { name: /Entrar a la partida de demostración/ }).click();
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
  await expect(page.locator('.map-building')).toHaveCount(15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'docs/screenshots/ciudad-mobile.png',
    fullPage: true,
    scale: 'css',
  });
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Mercado' })
    .click();
  await expect(page.getByRole('heading', { name: 'La próxima gran firma' })).toBeVisible();
  await expect(page.locator('.market-card')).toHaveCount(5);
});
test('puja secreta, reserva persistente y retirada', async ({ page }) => {
  await login(page);
  const state = await (await page.request.get('/api/state')).json();
  const ct = state.state.contracts.find(
    (ct: any) =>
      ct.clubId === state.clubId &&
      !state.state.clubs[0].selection.starters.some((s: any) => s.playerId === ct.playerId),
  );
  await page.request.post('/api/command', {
    data: { type: 'sell', playerId: ct.playerId },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  await page.goto('/market');
  await page.locator('.market-card').first().click();
  await page.getByLabel('Salario por convocatoria').fill('1000');
  await page.getByRole('button', { name: 'Enviar oferta secreta' }).click();
  await expect(page.getByRole('status')).toContainText('Oferta secreta guardada');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeVisible();
  await expect(page.getByLabel('Salario por convocatoria')).toHaveValue('1000');
  await page.goto('/market');
  await page.getByRole('button', { name: 'Mis ofertas' }).click();
  await page.getByRole('button', { name: 'Retirar oferta' }).first().click();
  await expect(page.getByRole('status')).toContainText('Oferta retirada');
});
test('actividad diaria, recompensa y bloqueo de repetición', async ({ page }) => {
  await login(page);
  await page.goto('/daily');
  const buttons = page.getByRole('button', { name: 'Realizar actividad' });
  await buttons.first().click();
  await expect(page.getByRole('button', { name: 'Ya forma parte de tu historia' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ya forma parte de tu historia' })).toBeDisabled();
});
test('obra, finalización en servidor y cambio del edificio', async ({ page }) => {
  await login(page);
  await page.goto('/building/hq');
  await page.getByRole('button', { name: 'Comenzar ampliación' }).click();
  await expect(page.getByText('Ampliación en curso')).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Terminar obras e investigación' }).click();
  await page.goto('/building/hq');
  await expect(page.getByText('NIVEL 2 / 5')).toBeVisible();
});
test('alineación, cierre de jornada e informe persistente', async ({ page }) => {
  await login(page);
  await page.goto('/squad');
  await expect(page.locator('.pitch-player')).toHaveCount(11);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Cerrar jornada', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Tiempo avanzado');
  await page.goto('/matchday');
  await page.locator('select').first().selectOption('1');
  await expect(page.getByRole('heading', { name: 'Los puntos, explicados' })).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/informe-mobile.png',
    fullPage: true,
    scale: 'css',
  });
});
test('chat entre dos presidentes y secreto de las pujas', async ({ browser }) => {
  const a = await browser.newContext(),
    b = await browser.newContext();
  const pa = await a.newPage(),
    pb = await b.newPage();
  await login(pa, 'demo1');
  await login(pb, 'demo2');
  await pa.goto('/chat');
  await pb.goto('/chat');
  await pa
    .getByRole('textbox', { name: 'Mensaje a la liga' })
    .fill('Mensaje de prueba entre presidentes');
  await pa.getByRole('button', { name: 'Enviar mensaje' }).click();
  await expect(pb.getByText('Mensaje de prueba entre presidentes')).toBeVisible({ timeout: 20000 });
  const state = await (await pb.request.get('/api/state')).json();
  expect(
    state.state.bids.every((bid: any) => bid.status !== 'open' || bid.clubId === state.clubId),
  ).toBe(true);
  await a.close();
  await b.close();
});
test('mantiene columna móvil en escritorio y carga todos los paneles', async ({ page }) => {
  await login(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.phone-shell')).toHaveCSS('max-width', '460px');
  expect((await page.locator('.phone-shell').boundingBox())!.width).toBeLessThanOrEqual(460);
  for (const path of [
    '/research',
    '/finance',
    '/marketing',
    '/concerts',
    '/institution',
    '/academy',
    '/training',
    '/fans',
    '/coaches',
    '/newspaper',
    '/events',
    '/museum',
    '/archive',
    '/bonuses',
    '/trades',
    '/draft',
    '/more',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.goto('/city');
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/ciudad-desktop.png',
    fullPage: true,
    scale: 'css',
  });
});
test('consulta caché al perder conexión y recupera operaciones al volver', async ({
  page,
  context,
}) => {
  await login(page);
  await page.goto('/daily');
  await expect(page.locator('.daily-card')).toHaveCount(3);
  await context.setOffline(true);
  await expect(page.getByRole('status').filter({ hasText: 'Sin conexión' }))
    .toBeVisible()
    .catch(async () => {
      await expect(page.getByText(/Sin conexión · Consultando/)).toBeVisible();
    });
  await expect(page.getByRole('button', { name: 'Realizar actividad' }).first()).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión · Consultando/)).toHaveCount(0);
});
test('PWA de producción: manifest, iconos, service worker y recarga sin conexión', async ({
  browser,
}) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3102/');
  await page.getByRole('button', { name: /Entrar a la partida de demostración/ }).click();
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
  const manifest = await (
    await page.request.get('http://127.0.0.1:3102/manifest.webmanifest')
  ).json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.orientation).toBe('portrait');
  for (const icon of manifest.icons)
    expect((await page.request.get('http://127.0.0.1:3102' + icon.src)).ok()).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
  expect(await page.evaluate(async () => (await caches.keys()).length)).toBeGreaterThan(0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Un club. Una corona.' })).toBeVisible();
  await expect(page.getByText(/Sin conexión · Consultando/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Sin conexión · Consultando/)).toHaveCount(0);
  await context.close();
});
