/* global document, Image, innerWidth, requestAnimationFrame */
import { chromium } from '@playwright/test';
import process from 'node:process';
import { URL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.REVIEW_URL || 'http://127.0.0.1:5175';
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
  throw Error('Solo revisión local aislada.');
const root = 'docs/screenshots/v02';
await mkdir(root, { recursive: true });
const browser = await chromium.launch(),
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
const errors = [],
  checks = [];
page.on('pageerror', (e) => errors.push(e.message));
async function shot(path) {
  await page.locator('h1').first().waitFor();
  await page.evaluate(async () => {
    await document.fonts.ready;
    const srcs = [
      ...new Set(
        [...document.querySelectorAll('svg image')]
          .map((el) => el.getAttribute('href'))
          .filter(Boolean),
      ),
    ];
    await Promise.all(
      srcs.map(async (src) => {
        const img = new Image();
        img.src = src;
        await img.decode();
      }),
    );
    await Promise.all([...document.images].map((img) => img.decode().catch(() => null)));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.screenshot({ path: `${root}/${path}.png`, fullPage: true });
  checks.push({
    path,
    ...(await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      nativeSelects: document.querySelectorAll('select').length,
      brokenImages: [...document.images]
        .filter((img) => img.complete && !img.naturalWidth)
        .map((img) => img.src),
    }))),
  });
}
async function command(data) {
  const response = await page.request.post(base + '/api/command', {
    data,
    headers: { 'Idempotency-Key': randomUUID() },
  });
  if (!response.ok()) throw Error(await response.text());
  return response.json();
}
await page.goto(base);
await page.request.post(base + '/api/demo', { data: { userId: 'demo1' } });
for (const route of [
  'city',
  'daily',
  'research',
  'finance',
  'newspaper',
  'squad',
  'settings',
  'more',
  'player/barcelona-10',
]) {
  await page.goto(base + '/' + route);
  await shot(route.replaceAll('/', '-') + '-390x844');
}
await page.goto(base + '/city');
await shot('map-after-390x844');
await page.goto(base + '/settings');
await page.getByRole('combobox', { name: 'Calidad gráfica' }).click();
await shot('custom-select-390x844');
await page.keyboard.press('Escape');
await command({ type: 'resourceVisibility', hidden: true });
await page.goto(base + '/finance');
await shot('resources-hidden-390x844');
await command({ type: 'resourceVisibility', hidden: false });
await page.goto(base + '/daily');
let game = await (await page.request.get(base + '/api/state')).json();
if (!game.state.clubs[0].activity || game.state.clubs[0].activity.claimedAt)
  await command({
    type: 'dailyStart',
    id: game.daily.find((a) => !game.state.clubs[0].dailyDone.includes(a.id)).id,
  });
await page.reload();
await shot('activity-running-390x844');
await command({ type: 'advance', step: 'activity' });
await page.reload();
await shot('activity-ready-390x844');
await page.getByRole('button', { name: 'Recoger recompensa' }).click();
await page.goto(base + '/research');
await page.getByRole('button', { name: /^Gestión salarial / }).click();
await shot('research-explained-390x844');
await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
await page.goto(base + '/building/hq');
await page.getByRole('button', { name: 'Comenzar ampliación' }).click();
await page.getByRole('button', { name: 'Cancelar · recuperar el 50 %' }).click();
await shot('cancel-confirmation-390x844');
await page.getByRole('button', { name: 'Continuar proyecto' }).click();
await page.goto(base + '/newspaper');
await page.locator('.article-title').first().click();
await page.getByRole('button', { name: 'Abrir chat de la liga' }).click();
await shot('newspaper-chat-over-article-390x844');
await page.getByRole('button', { name: 'Cerrar chat', exact: true }).click();
await shot('article-preserved-390x844');
await page.getByRole('button', { name: 'Cerrar artículo' }).click();
for (const viewport of [
  { width: 360, height: 800 },
  { width: 430, height: 932 },
  { width: 1440, height: 1000 },
]) {
  await page.setViewportSize(viewport);
  await page.goto(base + '/city');
  await shot(`map-${viewport.width}x${viewport.height}`);
  await page.goto(base + '/newspaper');
  await shot(`newspaper-${viewport.width}x${viewport.height}`);
}
await writeFile(`${root}/review.json`, JSON.stringify({ base, errors, checks }, null, 2));
console.log(JSON.stringify({ errors, checks }, null, 2));
await browser.close();
