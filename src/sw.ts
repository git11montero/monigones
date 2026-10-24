/// <reference lib="webworker" />
/** Activate for the NEXT navigation, never claim/reload a page being edited.
 * This also lets v0.3 clients (which had no update UI) recover on normal reopening. */
const sw = self as unknown as ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision?: string | null }[];
};
const shellPrefix = `monigones-shell:${sw.registration.scope}:`;
const shell = shellPrefix + __MONIGONES_BUILD_ID__;
const entries = (self as unknown as { __WB_MANIFEST: { url: string; revision?: string | null }[] })
  .__WB_MANIFEST;
const urls = new Set(entries.map((e) => new URL(e.url, sw.registration.scope).href));
const versions = new Map<string, string>();
sw.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(shell);
      try {
        const results = await Promise.allSettled(
          entries.map(async ({ url, revision }) => {
            const target = new URL(url, sw.registration.scope);
            const request = new URL(target);
            if (revision) request.searchParams.set('__monigones_revision', revision);
            const response = await fetch(request, { cache: 'reload' });
            if (!response.ok) throw Error('Incomplete application shell');
            await cache.put(target, response);
          }),
        );
        if (results.some((result) => result.status === 'rejected'))
          throw Error('Incomplete application shell');
        await sw.skipWaiting();
      } catch (error) {
        await caches.delete(shell);
        throw error;
      }
    })(),
  );
});
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // No clients.claim(): unsent messages/forms and the old asset set remain intact.
      for (const client of await sw.clients.matchAll({ type: 'window', includeUncontrolled: true }))
        client.postMessage({ type: 'MONIGONES_VERSION', buildId: __MONIGONES_BUILD_ID__ });
    })(),
  );
});
sw.addEventListener('message', (event) => {
  if (event.data?.type !== 'MONIGONES_CLIENT_VERSION' || !event.source) return;
  const source = event.source as Client;
  versions.set(source.id, event.data.buildId);
  source.postMessage({ type: 'MONIGONES_VERSION', buildId: __MONIGONES_BUILD_ID__ });
  event.waitUntil(
    (async () => {
      const clients = (
        await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
      ).filter((c) => c.url.startsWith(sw.registration.scope));
      // Retain older shells while ANY old/unknown tab may still need its lazy chunks.
      if (clients.some((c) => versions.get(c.id) !== __MONIGONES_BUILD_ID__)) return;
      for (const name of await caches.keys()) {
        const ownShell = name.startsWith(shellPrefix);
        const legacyShell =
          name.startsWith('workbox-precache-v2-') && name.endsWith(sw.registration.scope);
        if ((ownShell || legacyShell) && name !== shell) await caches.delete(name);
      }
    })(),
  );
});
async function image(
  event: FetchEvent,
  name: string,
  maximum: number,
  days: number,
  networkFirst: boolean,
) {
  const request = event.request;
  const cache = await caches.open(name);
  const stored = await cache.match(request);
  const age = Date.now() - Date.parse(stored?.headers.get('date') || '');
  const valid = stored && (!Number.isFinite(age) || age < days * 86400000);
  if (valid && !networkFirst) return stored;
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      for (const key of keys.slice(0, Math.max(0, keys.length - maximum))) await cache.delete(key);
    }
    return response;
  });
  event.waitUntil(network.then(() => undefined).catch(() => undefined));
  if (valid) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        network,
        new Promise<Response>((resolve) => {
          timer = setTimeout(() => resolve(stored), 3000);
        }),
      ]);
    } catch {
      return stored;
    } finally {
      clearTimeout(timer);
    }
  }
  return network;
}
sw.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== sw.location.origin ||
    url.pathname.startsWith('/api/')
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () =>
        (await (await caches.open(shell)).match(new URL('index.html', sw.registration.scope))) ||
        fetch(request))(),
    );
  } else if (urls.has(url.href)) {
    event.respondWith(
      (async () => (await (await caches.open(shell)).match(request)) || fetch(request))(),
    );
  } else if (/^\/assets\/futbol\/.*\.png$/.test(url.pathname)) {
    event.respondWith(image(event, 'monigones-local-football-v3', 550, 30, true));
  } else if (/^\/sports\/.*\.(jpg|jpeg|png|webp)$/.test(url.pathname)) {
    event.respondWith(image(event, 'monigones-sports-v1', 180, 14, false));
  }
});
