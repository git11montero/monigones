export const BUILD_ID = __MONIGONES_BUILD_ID__;
let registration: ServiceWorkerRegistration | undefined;
let available = false;
let checking = false;
let started = false;
const subscribers = new Set<() => void>();
export const updateSnapshot = () => available;
export function subscribeUpdates(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}
function notify() {
  available = true;
  subscribers.forEach((fn) => fn());
}
function introduce() {
  registration?.active?.postMessage({ type: 'MONIGONES_CLIENT_VERSION', buildId: BUILD_ID });
}
export async function checkUpdate() {
  if (!registration || checking || !navigator.onLine || document.hidden) return;
  checking = true;
  try {
    await registration.update();
    introduce();
  } catch {
    /* Offline/server unavailable: keep the working shell and retry on focus/online. */
  } finally {
    checking = false;
  }
}
export function startUpdates() {
  if (!__MONIGONES_SW_ENABLED__ || !('serviceWorker' in navigator) || started) return;
  started = true;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'MONIGONES_VERSION' && event.data.buildId !== BUILD_ID) notify();
  });
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/', updateViaCache: 'none' })
    .then((r) => {
      registration = r;
      introduce();
      r.addEventListener('updatefound', () => {
        const worker = r.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'activated') introduce();
        });
      });
      void checkUpdate();
    })
    .catch(() => {
      /* Registration failure must not prevent online play. */
    });
  window.setInterval(() => void checkUpdate(), 5 * 60 * 1000);
  window.addEventListener('online', () => void checkUpdate());
  document.addEventListener('visibilitychange', () => void checkUpdate());
  window.addEventListener('focus', () => void checkUpdate());
  // A retired lazy chunk produces an actionable update, never an automatic reload loop.
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    notify();
    void checkUpdate();
  });
}
export async function applyUpdate() {
  await checkUpdate();
  // Explicit user action only; native beforeunload protects dirty forms in every tab.
  window.location.reload();
}
