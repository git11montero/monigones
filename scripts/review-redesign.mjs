/* global innerWidth, document, Image */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true }),
  page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('docs/screenshots/redesign/review', { recursive: true });
await page.goto('http://127.0.0.1:5175/');
await page.screenshot({ path: 'docs/screenshots/redesign/review/acceso.png', fullPage: true });
await page.request.post('http://127.0.0.1:5175/api/demo', { data: { userId: 'demo1' } });
for (const route of [
  'city',
  'market',
  'research',
  'building/stadium',
  'building/hq',
  'squad',
  'matchday',
  'newspaper',
  'concerts',
  'institution',
  'settings',
]) {
  await page.goto('http://127.0.0.1:5175/' + route);
  await page.locator('h1').first().waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({
    path: `docs/screenshots/redesign/review/${route.replaceAll('/', '-')}.png`,
    fullPage: true,
  });
  console.log(
    route,
    await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      images: [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src),
    })),
  );
}
const alpha = await page.evaluate(async () => {
  const img = new Image();
  img.src = '/art/core-atlas.webp';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return { corner: [...ctx.getImageData(0, 0, 1, 1).data], width: img.width, height: img.height };
});
console.log({ alpha, errors });
await writeFile('docs/screenshots/redesign/review/errors.json', JSON.stringify(errors, null, 2));
await browser.close();
