import { test, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';
import { generateSW } from 'workbox-build';
import { execFileSync } from 'node:child_process';

// Real generated Workbox v0.3 lifecycle, with a deliberately obsolete build-time
// configuration. No production host, token, Auth user or league is contacted.
test('v04: Workbox antiguo retiene configuración obsoleta; siguiente navegación recupera sin borrar sesión', async ({
  browser,
}) => {
  test.setTimeout(150000);
  const work = await mkdtemp(join(tmpdir(), 'monigones-pwa-update-'));
  let generation = 0;
  let incomplete = false;
  await writeFile(
    join(work, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Falta la configuración pública de Supabase</h1>
    <textarea aria-label="Mensaje sin enviar"></textarea><script>
    navigator.serviceWorker.register('/sw.js').then(r => r.addEventListener('updatefound', () => {
      r.installing.addEventListener('statechange', () => window.dispatchEvent(new Event('crown:update')));
    }));</script></body></html>`,
  );
  await generateSW({
    swDest: join(work, 'sw.js'),
    globDirectory: work,
    globPatterns: ['index.html'],
    navigateFallback: '/index.html',
    clientsClaim: true,
    skipWaiting: false,
  });
  const next = join(work, 'next');
  execFileSync(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'build', '--outDir', next, '--emptyOutDir'],
    {
      stdio: 'pipe',
      env: {
        ...process.env,
        VITE_BACKEND: 'local',
        MONIGONES_BUILD_ID: 'v04-update-regression-next',
      },
    },
  );
  const types: Record<string, string> = {
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.html': 'text/html',
    '.css': 'text/css',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  const server = createServer(async (req, res) => {
    try {
      if (req.url?.startsWith('/api/')) {
        const upstream = await fetch(`http://127.0.0.1:3102${req.url}`, {
          headers: req.headers.cookie ? { cookie: req.headers.cookie } : {},
        });
        res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      const path = new URL(req.url || '/', 'http://fixture').pathname;
      const file = path === '/' || !extname(path) ? 'index.html' : path.slice(1);
      if (incomplete && file === 'icon-512.png') {
        res.writeHead(503).end();
        return;
      }
      const root = generation === 2 ? next : generation ? resolve('dist') : work;
      const target = resolve(root, file);
      if (!target.startsWith(root + '/')) {
        res.writeHead(400).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(await readFile(target));
    } catch {
      if (!res.headersSent) res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address() as { port: number };
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await chromium.launchPersistentContext(join(work, 'browser-profile'), {
    viewport: { width: 390, height: 844 },
    headless: true,
  });
  try {
    // Obtain a REAL session cookie in the disposable SQLite test server, never the user's save.
    const response = await context.request.post('http://127.0.0.1:3102/api/demo', {
      data: { userId: 'demo1' },
    });
    const cookie = response.headers()['set-cookie'].split(';')[0].split('=');
    await context.addCookies([{ name: cookie[0], value: cookie.slice(1).join('='), url: origin }]);
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      localStorage.setItem(
        'monigones-preferences-v1',
        JSON.stringify({ music: false, volume: 0.2 }),
      );
      localStorage.setItem('monigones-install-never', 'yes');
      localStorage.setItem(
        'sb-fixture-auth-token',
        JSON.stringify({ access_token: 'test-only-session-marker' }),
      );
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.getByLabel('Mensaje sin enviar').fill('No perder este borrador');
    generation = 1;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await page.waitForFunction(async () =>
      (await navigator.serviceWorker.getRegistration())?.active?.scriptURL.endsWith('/sw.js'),
    );
    // Wait until the newly activated worker responds with its actual compiled version.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('message', function receive(e) {
          if (e.data?.type === 'MONIGONES_VERSION') {
            navigator.serviceWorker.removeEventListener('message', receive);
            resolve();
          }
        });
        void navigator.serviceWorker.getRegistration().then((r) => {
          const worker = r?.installing || r?.waiting || r?.active;
          if (worker?.state === 'activated')
            worker.postMessage({ type: 'MONIGONES_CLIENT_VERSION', buildId: 'legacy' });
          else
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'activated')
                worker.postMessage({ type: 'MONIGONES_CLIENT_VERSION', buildId: 'legacy' });
            });
        });
      });
    });
    await expect(page.getByLabel('Mensaje sin enviar')).toHaveValue('No perder este borrador');
    await expect(page.locator('h1')).toHaveText('Falta la configuración pública de Supabase');
    const other = await context.newPage();
    await other.goto(origin + '/city');
    await expect(other.locator('.city-map')).toBeVisible();
    // An open legacy tab keeps its own shell/chunks until the user chooses to navigate.
    expect(
      await other.evaluate(async () =>
        (await caches.keys()).some((n) => n.startsWith('workbox-precache-v2-')),
      ),
    ).toBe(true);
    await page.close();
    await other.reload();
    await expect(other.locator('.city-map')).toBeVisible();
    await expect
      .poll(() =>
        other.evaluate(async () =>
          (await caches.keys()).some((n) => n.startsWith('workbox-precache-v2-')),
        ),
      )
      .toBe(false);
    expect(
      await other.evaluate(() => JSON.parse(localStorage.getItem('monigones-preferences-v1')!)),
    ).toMatchObject({ music: false, volume: 0.2 });
    expect(await other.evaluate(() => localStorage.getItem('sb-fixture-auth-token'))).toContain(
      'test-only-session-marker',
    );
    const installedPage = await context.newPage();
    await installedPage.addInitScript(() =>
      Object.defineProperty(navigator, 'standalone', { value: true }),
    );
    await installedPage.goto(origin + '/city');
    await expect(installedPage.locator('.city-map')).toBeVisible();
    // A second actual compiled v0.4 shell: update UI, unsent form and no forced reload.
    await other.goto(origin + '/chat');
    await other
      .getByRole('textbox', { name: 'Mensaje a la liga' })
      .fill('Borrador entre versiones');
    let navigations = 0;
    other.on('framenavigated', (frame) => {
      if (frame === other.mainFrame()) navigations++;
    });
    generation = 2;
    incomplete = true;
    await other.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect
      .poll(() =>
        other.evaluate(async () => {
          return !!(await navigator.serviceWorker.getRegistration())?.installing;
        }),
      )
      .toBe(false);
    await expect(other.getByText('Nueva versión disponible', { exact: true })).toHaveCount(0);
    await expect(other.getByRole('textbox', { name: 'Mensaje a la liga' })).toHaveValue(
      'Borrador entre versiones',
    );
    expect(
      await other.evaluate(async () =>
        (await caches.keys()).some((n) => n.endsWith('v04-update-regression-next')),
      ),
    ).toBe(false);
    incomplete = false;
    await other.evaluate(async () => {
      await (await navigator.serviceWorker.getRegistration())!.update();
    });
    await expect(other.getByText('Nueva versión disponible', { exact: true })).toBeVisible();
    await expect(
      installedPage.getByText('Nueva versión disponible', { exact: true }),
    ).toBeVisible();
    await expect(other.getByRole('textbox', { name: 'Mensaje a la liga' })).toHaveValue(
      'Borrador entre versiones',
    );
    expect(navigations).toBe(0);
    other.once('dialog', (dialog) => void dialog.dismiss());
    await other.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await expect(other.getByRole('textbox', { name: 'Mensaje a la liga' })).toHaveValue(
      'Borrador entre versiones',
    );
    expect(navigations).toBe(0);
    other.once('dialog', (dialog) => void dialog.accept());
    await other.getByRole('button', { name: 'Actualizar', exact: true }).click();
    // The existing chat deliberately persists drafts in sessionStorage.
    await expect(other.getByRole('textbox', { name: 'Mensaje a la liga' })).toHaveValue(
      'Borrador entre versiones',
    );
    await expect(other.getByText('Nueva versión disponible', { exact: true })).toHaveCount(0);
    expect(navigations).toBe(1);
    await other.waitForTimeout(1000);
    expect(navigations).toBe(1);
    // Updating one window never forces the installed-app simulation to reload.
    await expect(
      installedPage.getByText('Nueva versión disponible', { exact: true }),
    ).toBeVisible();
    await expect(installedPage.locator('.city-map')).toBeVisible();
    await installedPage.close();
    // A private/clean context receives the current build immediately, without the obsolete error.
    const clean = await browser.newContext();
    try {
      const fresh = await clean.newPage();
      await fresh.goto(origin);
      await expect(
        fresh.getByRole('button', { name: /Entrar a la partida de demostración/ }),
      ).toBeVisible();
    } finally {
      await clean.close();
    }
    // Expired/revoked API session returns to auth; cache cleanup never resurrects it.
    await other.getByRole('textbox', { name: 'Mensaje a la liga' }).fill('');
    await context.clearCookies();
    await other.reload();
    await expect(
      other.getByRole('button', { name: /Entrar a la partida de demostración/ }),
    ).toBeVisible();
  } finally {
    await context.close();
    await new Promise<void>((done) => server.close(() => done()));
    await rm(work, { recursive: true, force: true });
  }
});
