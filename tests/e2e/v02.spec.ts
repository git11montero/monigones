import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { createGame } from '../../shared/seed';
import type { GameState } from '../../shared/types';
import { dailyKey } from '../../shared/math';
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
async function command(page: Page, data: Record<string, unknown>) {
  const res = await page.request.post('/api/command', {
    data,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
}
test('avisos: mercado consultado sincroniza entre sesiones; renovación y noticia nuevos reaparecen', async ({
  page,
  browser,
}, info) => {
  fixture(info);
  await login(page);
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5174' });
  try {
    const second = await context.newPage();
    await login(second);
    await page.goto('/market');
    await expect
      .poll(async () => {
        const s = await (await second.request.get('/api/state')).json();
        return s.notifications.find((n: any) => n.type === 'market').read;
      })
      .toBe(true);
    await second.goto('/city');
    await expect(second.locator('.bottom-nav a[href="/market"] .attention-badge')).toHaveCount(0);
    await command(page, { type: 'advance', step: 'market' });
    await second.reload();
    await expect(second.locator('.bottom-nav a[href="/market"] .attention-badge')).toBeVisible();
    await second.goto('/newspaper');
    await expect
      .poll(async () => {
        const s = await (await second.request.get('/api/state')).json();
        return s.notifications.filter(
          (n: any) => n.type === 'news' && !n.read && dailyKey(n.at) === dailyKey(s.state.now),
        ).length;
      })
      .toBe(0);
  } finally {
    await context.close();
  }
});
test('recursos ocultos persisten al navegar y recargar, sin ocultar el coste de una compra', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  const initial = await (await page.request.get('/api/state')).json();
  await page.goto('/more');
  await page.getByRole('button', { name: 'Ocultar recursos' }).click();
  await expect(page.locator('.club-resource-grid .resource-amount')).toHaveText(
    Array(6).fill('••••'),
  );
  await page.goto('/finance');
  await expect(page.locator('.balance-card .resource-amount').first()).toHaveText('••••');
  await page.reload();
  await page.goto('/more');
  await expect(page.getByRole('button', { name: 'Mostrar recursos' })).toBeVisible();
  await page.goto('/finance');
  await expect(page.locator('.ledger-list')).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar detalles de movimientos' }).click();
  await expect(page.locator('.ledger-list')).toBeVisible();
  await page.goto('/building/hq');
  await expect(page.locator('.quote')).toContainText('300.000');
  const after = await (await page.request.get('/api/state')).json();
  expect(after.state.clubs[0].resources.money).toBe(initial.state.clubs[0].resources.money);
  await page.goto('/more');
  await page.getByRole('button', { name: 'Mostrar recursos' }).click();
  await expect(page.locator('.club-resource-grid .resource-amount').first()).not.toHaveText('••••');
});
test('selectores: táctil, teclado, opciones bloqueadas y portal dentro de la pantalla', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  await page.goto('/settings');
  const select = page.getByRole('combobox', { name: 'Calidad gráfica' });
  await select.tap();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: /Baja/ }).tap();
  await expect(select).toContainText('Baja');
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(select).toContainText('Alta');
  await select.click();
  const box = (await page.getByRole('listbox').boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y + box.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(select).toBeFocused();
  await page.goto('/squad');
  await page.getByRole('combobox').click();
  await expect(page.getByRole('option').filter({ hasText: '4-3-3' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.keyboard.press('Escape');
  expect(await page.locator('select').count()).toBe(0);
});
test('cancelación de obra: volver conserva el trabajo; confirmar muestra y aplica el reembolso real', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  await page.goto('/building/hq');
  await page.getByRole('button', { name: 'Comenzar ampliación' }).click();
  const before = await (await page.request.get('/api/state')).json(),
    job = before.state.jobs[0];
  await page.getByRole('button', { name: 'Cancelar · recuperar el 50 %' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('150.000');
  await expect(dialog).toContainText('irreversible');
  await page.getByRole('button', { name: 'Continuar proyecto' }).click();
  expect((await (await page.request.get('/api/state')).json()).state.jobs).toHaveLength(1);
  await page.getByRole('button', { name: 'Cancelar · recuperar el 50 %' }).click();
  await page.getByRole('button', { name: 'Sí, cancelar proyecto' }).click();
  await expect(page.getByText('No tienes obras en curso.')).toBeVisible();
  const after = await (await page.request.get('/api/state')).json();
  expect(after.state.clubs[0].resources.money).toBe(
    before.state.clubs[0].resources.money + Math.floor(job.money / 2),
  );
});
test('chat integrado: otro presidente recibe, identifica y consulta el mismo mensaje persistente', async ({
  page,
  browser,
}, info) => {
  fixture(info);
  await login(page);
  const other = await browser.newContext({
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 390, height: 844 },
  });
  try {
    const second = await other.newPage();
    await login(second, 'demo2');
    await second.goto('/newspaper');
    await page.goto('/newspaper');
    await page.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    const text = 'El periódico también tiene vestuario ' + crypto.randomUUID();
    await page.getByRole('textbox', { name: 'Mensaje a la liga' }).fill(text);
    await page.getByRole('button', { name: 'Enviar mensaje' }).click();
    await expect(second.locator('.newspaper-chat-toggle .attention-badge')).toBeVisible({
      timeout: 20000,
    });
    await second.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    await expect(second.getByText(text)).toBeVisible({ timeout: 20000 });
    await expect(second.getByText('Presidente 1 · Real Corona').first()).toBeVisible();
    await expect(second.locator('.newspaper-chat-toggle .attention-badge')).toHaveCount(0);
    await second.getByRole('button', { name: 'Cerrar chat', exact: true }).click();
    await expect(second.getByRole('heading', { name: /El Balonazo/ })).toBeVisible();
    await second.reload();
    await second.getByRole('button', { name: 'Abrir chat de la liga' }).click();
    await expect(second.getByText(text)).toHaveCount(1);
  } finally {
    await other.close();
  }
});
test('actividad: recompensa manual, reloj del dispositivo sin autoridad y bloqueo tras cobrar', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  await page.goto('/daily');
  await page.getByRole('button', { name: 'Iniciar actividad', exact: true }).first().click();
  await expect(page.getByRole('region', { name: 'Actividad en curso' })).toBeVisible();
  const active = await (await page.request.get('/api/state')).json(),
    run = active.state.clubs[0].activity;
  await page.clock.install({ time: new Date(Date.now() + 10 * 86400000) });
  const early = await page.request.post('/api/command', {
    data: { type: 'dailyClaim', id: run.id },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(early.ok()).toBe(false);
  await page.clock.resume();
  await command(page, { type: 'advance', step: 'activity' });
  await page.reload();
  await expect(page.locator('.activity-running')).toContainText('RECOMPENSA LISTA');
  await page.getByRole('button', { name: 'Recoger recompensa' }).click();
  await expect(page.getByRole('button', { name: 'Recoger recompensa' })).toHaveCount(0);
  const again = await page.request.post('/api/command', {
    data: { type: 'dailyClaim', id: run.id },
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
  expect(again.ok()).toBe(false);
  await page.reload();
  expect(
    (await (await page.request.get('/api/state')).json()).state.clubs[0].activityHistory,
  ).toHaveLength(1);
});
test('investigación: compara porcentajes reales, coste, requisitos y efecto pendiente sin promesas', async ({
  page,
}, info) => {
  fixture(info, (s) => {
    s.clubs[0].research.salary = 2;
    s.clubs[0].buildings.research = 5;
  });
  await login(page);
  await page.goto('/research');
  await page.getByRole('button', { name: /^Gestión salarial / }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('0,6 puntos porcentuales');
  await expect(dialog).toContainText('0,9 puntos porcentuales');
  await expect(dialog).toContainText('140.000');
  await expect(dialog).toContainText('110.000');
  await expect(dialog.locator('.quote')).toContainText('500 PD');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Relaciones', exact: true }).click();
  await page.getByRole('button', { name: /^Identidad corporativa / }).click();
  await expect(page.getByRole('dialog')).toContainText('EFECTO AVANZADO PENDIENTE');
});
test('un borrador de identidad pide confirmación al salir; volver conserva los cambios', async ({
  page,
}, info) => {
  fixture(info);
  await login(page);
  await page.locator('.bottom-nav a[href="/more"]').click();
  await page.locator('.more-links a[href="/settings"]').click();
  await page.getByRole('textbox', { name: 'Nombre del club' }).fill('Un borrador del club');
  await page.evaluate(() => history.back());
  await expect(page.getByRole('dialog')).toContainText('no se han enviado');
  await page.getByRole('button', { name: 'Seguir editando' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del club' })).toHaveValue(
    'Un borrador del club',
  );
  await page.locator('.bottom-nav a[href="/city"]').click();
  await page.getByRole('button', { name: 'Sí, salir sin guardar' }).click();
  await expect(page).toHaveURL(/city/);
});
