import { test, expect } from '@playwright/test';
test('archivo visual del diseño anterior', async ({ page }) => {
  test.skip(
    process.env.AUDIT_BEFORE !== '1',
    'Captura histórica, se ejecuta antes de modificar la interfaz.',
  );
  test.setTimeout(120000);
  await page.goto('/');
  await page.screenshot({ path: 'docs/screenshots/redesign/before/acceso.png', fullPage: true });
  await page.request.post('/api/demo', { data: { userId: 'demo1' } });
  const data = await (await page.request.get('/api/state')).json();
  for (const route of [
    'city',
    'building/hq',
    'building/stadium',
    'building/offices',
    'market',
    `player/${data.state.players[0].id}`,
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
  ]) {
    await page.goto('/' + route);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/redesign/before/${route.replaceAll('/', '-')}.png`,
      fullPage: true,
      scale: 'css',
    });
  }
});
