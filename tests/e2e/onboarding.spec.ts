import { test, expect } from '@playwright/test';
test('registro, creación de club, invitación y draft conectados al servidor', async ({
  page,
  browser,
}) => {
  const email = `presidente-${crypto.randomUUID()}@example.test`;
  const registered = await page.request.post('/api/register', {
    data: { email, password: 'Monigones-2026-segura', name: 'Presidente QA' },
  });
  expect(registered.status(), await registered.text()).toBe(201);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Dale un hogar/ })).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/v03/regressions/redesign/crear-club.png',
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Tengo invitación' }).click();
  await expect(page.getByLabel('Código de invitación')).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/v03/regressions/redesign/invitacion.png',
    fullPage: true,
    scale: 'css',
  });
  await page.getByRole('button', { name: 'Crear liga', exact: true }).click();
  await page.getByLabel('Nombre de la liga').fill('La liga del rediseño');
  await page.getByLabel('Nombre de tu club').fill('Monigones United');
  await page.getByRole('button', { name: 'Fundar mi club' }).click();
  await expect(page.getByRole('heading', { name: 'Ciudad deportiva' })).toBeVisible();
  const game = await (await page.request.get('/api/state')).json();
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 390, height: 844 },
  });
  try {
    const guest = await context.newPage();
    await guest.request.post('/api/register', {
      data: {
        email: `invitado-${crypto.randomUUID()}@example.test`,
        password: 'Monigones-2026-segura',
        name: 'Invitado QA',
      },
    });
    await guest.goto('/');
    await guest.getByRole('button', { name: 'Tengo invitación' }).click();
    await guest.getByLabel('Código de invitación').fill(game.state.invite);
    await guest.getByLabel('Nombre de tu club').fill('Atlético Invitado');
    await guest.getByRole('button', { name: 'Entrar a la liga', exact: true }).click();
    await expect(guest.getByRole('heading', { name: 'Ciudad deportiva' })).toBeVisible();
    const joined = await (await guest.request.get('/api/state')).json();
    expect(joined.state.id).toBe(game.state.id);
  } finally {
    await context.close();
  }
  await page.goto('/draft');
  await page.getByRole('button', { name: 'Presentar futbolista' }).click();
  await expect(page.getByRole('status')).toContainText('Nuevo futbolista');
  await expect(page.locator('.auction-card .sports-card')).toHaveCount(1);
  await page.screenshot({
    path: 'docs/screenshots/v03/regressions/redesign/draft-activo.png',
    fullPage: true,
    scale: 'css',
  });
});
