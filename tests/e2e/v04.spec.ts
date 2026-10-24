import { test, expect, type Page } from '@playwright/test';
import { BUILDINGS } from '../../shared/config';
import { mkdirSync } from 'node:fs';
const root = 'docs/screenshots/v04';
async function login(page: Page) {
  await page.request.post('/api/demo', { data: { userId: 'demo1' } });
  await page.goto('/city');
  await expect(page.locator('.map-building')).toHaveCount(15);
}
test('v04: recursos contextuales, 15 accesos, preferencia y auditoría de cuatro móviles y escritorio', async ({
  page,
}) => {
  test.setTimeout(120000);
  mkdirSync(root, { recursive: true });
  await login(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto('/city');
    await expect(page.locator('.resource-bar')).toHaveCount(0);
    const map = page.locator('.city-map');
    await expect(map).toHaveAttribute('data-ready', 'true');
    const box = (await map.boundingBox())!;
    expect(box.height).toBeGreaterThan(height < 600 ? 300 : 470);
    await page.screenshot({ path: `${root}/mapa-${width}x${height}.png`, scale: 'css' });
    // Every badge lives inside its label, and inherits exactly the same map transform.
    expect(await page.locator('.map-building > .attention-badge').count()).toBe(0);
    await page.getByRole('button', { name: 'Secciones', exact: true }).click();
    await expect(page.locator('.city-section-access')).toHaveCount(15);
    for (const b of BUILDINGS) {
      const access = page.locator(`.city-section-access[data-building="${b.id}"]`);
      await expect(access).toHaveAttribute('href', `/building/${b.id}`);
      await expect(access.locator('.section-building-name')).toContainText(b.name);
    }
    await page.screenshot({ path: `${root}/secciones-${width}x${height}.png`, scale: 'css' });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Secciones', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.locator('.city-section-access[data-building="research"]').click();
    await expect(page.locator('.operation-resources')).toContainText('Disponible:');
    await expect(page.locator('.operation-resources')).toContainText('PD');
    await page.goto('/more');
    await expect(page.locator('.club-resource-grid a')).toHaveCount(6);
    await expect(page.locator('.club-resources')).toContainText('Tesorería');
    await page.screenshot({ path: `${root}/mi-club-${width}x${height}.png`, scale: 'css' });
    for (const path of ['/market', '/squad', '/research', '/daily', '/chat', '/settings']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        path,
      ).toBe(true);
      await expect(page.locator('.bottom-nav')).toBeVisible();
    }
    await page.goto('/city');
    await page.getByRole('button', { name: 'Mapa', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
test('v04: gestos de mapa, scroll de secciones y zoom accesible sin restricción de viewport', async ({
  page,
}) => {
  await login(page);
  const meta = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(meta).not.toMatch(/user-scalable|maximum-scale/);
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  const map = page.locator('.city-map');
  expect(await map.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
  expect(
    await page.locator('.phone-shell').evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe('pan-y');
  const session = await page.context().newCDPSession(page);
  const box = (await map.boundingBox())!,
    y = box.y + box.height / 2;
  const originalZoom = await map.getAttribute('data-zoom');
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 140, y },
      { x: 240, y },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 90, y },
      { x: 290, y },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(map).not.toHaveAttribute('data-zoom', originalZoom!);
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
  await page.getByRole('button', { name: 'Secciones', exact: true }).click();
  const surface = page.locator('.city-view-sections .city-content');
  await session.send('Input.synthesizeScrollGesture', {
    x: 180,
    y: 500,
    yDistance: -300,
    gestureSourceType: 'touch',
    speed: 600,
  });
  await expect.poll(() => surface.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  // A two-finger gesture over the list must not scale the page.
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: 140, y: 300 },
      { x: 240, y: 300 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: 90, y: 300 },
      { x: 290, y: 300 },
    ],
  });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await page.evaluate(() => visualViewport?.scale)).toBe(1);
});
test('v04: iOS sin prompt, instrucciones, descarte persistente y standalone', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('v04-started')) {
      localStorage.removeItem('monigones-install-never');
      sessionStorage.setItem('v04-started', 'yes');
    }
  });
  await login(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Instala Monigones en tu móvil');
  await expect(dialog).toContainText('Compartir');
  await expect(dialog).toContainText('Abrir como app web');
  expect(
    await dialog.evaluate((modal) => {
      const box = document.querySelector('.city-view-switch')!.getBoundingClientRect();
      return modal.contains(
        document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
      );
    }),
  ).toBe(true);
  mkdirSync(root, { recursive: true });
  await page.screenshot({ path: `${root}/instalacion-ios-390x844.png`, scale: 'css' });
  await expect(dialog.getByRole('button', { name: 'Instalar Monigones', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'No volver a mostrar', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('monigones-install-never'))).toBe('yes');
  await page.goto('/market');
  await page.goto('/city');
  await page.waitForTimeout(3700);
  await expect(dialog).toHaveCount(0);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { value: true });
  });
  await page.reload();
  await page.waitForTimeout(3700);
  await expect(dialog).toHaveCount(0);
});
test('v04: Android captura instalación nativa y espera al botón; fallback sin evento', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',
  });
  try {
    const page = await context.newPage();
    await login(page);
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt', { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.body.dataset.prompts = '1';
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(event);
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    mkdirSync(root, { recursive: true });
    await page.screenshot({ path: `${root}/instalacion-android-390x844.png`, scale: 'css' });
    expect(await page.locator('body').getAttribute('data-prompts')).toBeNull();
    await page.getByRole('button', { name: 'Instalar Monigones', exact: true }).click();
    await expect(page.locator('body')).toHaveAttribute('data-prompts', '1');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await page.locator('.bottom-nav a[href="/more"]').click();
    await page.getByRole('link', { name: 'Ajustes y administración' }).click();
    await expect(page.getByText('Monigones se está ejecutando como aplicación.')).toBeVisible();
  } finally {
    await context.close();
  }
  const fallback = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Android Chrome',
  });
  try {
    const page = await fallback.newPage();
    await login(page);
    await expect(page.getByRole('dialog')).toContainText('El nombre puede variar');
    await page.getByRole('button', { name: 'Ahora no', exact: true }).click();
    await page.reload();
    await page.waitForTimeout(3700);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  } finally {
    await fallback.close();
  }
});
test('v04: audio tras login, contexto único entre rutas y preferencias conservadas', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    (window as any).__contexts = [];
    window.AudioContext = class extends Original {
      constructor() {
        super();
        (window as any).__contexts.push(this);
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Entrar a la partida de demostración/ }).click();
  await expect(page.locator('.city-map')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as any).__contexts[0]?.state))
    .toBe('running');
  await page.locator('.bottom-nav a[href="/more"]').click();
  await page.getByRole('link', { name: 'Ajustes y administración' }).click();
  await expect(page.getByLabel('Música ambiental')).toBeChecked();
  expect(await page.evaluate(() => (window as any).__contexts.length)).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__contexts[0]?.state))
    .toBe('suspended');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__contexts[0]?.state))
    .toBe('running');
  expect(await page.evaluate(() => (window as any).__contexts.length)).toBe(1);
  await page.getByLabel('Música ambiental').uncheck();
  await page.reload();
  await expect(page.getByLabel('Música ambiental')).not.toBeChecked();
  await page.getByRole('button', { name: 'Probar efectos' }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__contexts[0]?.state))
    .toBe('running');
  expect(await page.evaluate(() => (window as any).__contexts.length)).toBe(1);
});
