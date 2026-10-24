export type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
export const INSTALL_NEVER = 'monigones-install-never';
export const INSTALL_LATER = 'monigones-install-later';
let deferred: InstallEvent | null = null;
let installed = false;
let started = false;
const listeners = new Set<() => void>();
let snapshot: { event: InstallEvent | null; standalone: boolean } = {
  event: deferred,
  standalone: false,
};
const emit = () => {
  snapshot = { event: deferred, standalone: isStandalone() };
  listeners.forEach((fn) => fn());
};
export function isStandalone() {
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
export function mobilePlatform(ua = navigator.userAgent, touches = navigator.maxTouchPoints) {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && touches > 1)) return 'ios';
  return /Android/i.test(ua) ? 'android' : null;
}
export function installEligible() {
  if (!mobilePlatform() || isStandalone()) return false;
  try {
    return (
      localStorage.getItem(INSTALL_NEVER) !== 'yes' &&
      Date.now() - Number(localStorage.getItem(INSTALL_LATER) || 0) > 86400000 &&
      sessionStorage.getItem('monigones-install-seen') !== 'yes'
    );
  } catch {
    return true;
  }
}
export function dismissInstallation(never = false) {
  try {
    sessionStorage.setItem('monigones-install-seen', 'yes');
    localStorage.setItem(never ? INSTALL_NEVER : INSTALL_LATER, never ? 'yes' : String(Date.now()));
  } catch {
    /* A private browser may not allow preference storage. */
  }
}
export const installationSnapshot = () => snapshot;
export function subscribeInstallation(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export function captureInstallation() {
  if (started) return;
  started = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as InstallEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    emit();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener('change', emit);
}
export async function promptInstallation() {
  if (!deferred) return;
  const event = deferred;
  deferred = null;
  emit();
  // Called synchronously from the install button, preserving browser user activation.
  await event.prompt();
  const choice = await event.userChoice;
  return choice.outcome;
}
