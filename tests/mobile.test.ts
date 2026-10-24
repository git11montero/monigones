// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AudioManager,
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  readPreferences,
} from '../src/lib/audio';
import { buildingAccess, CITY_GROUPS, readCityView } from '../src/lib/city-access';
import { BUILDINGS } from '../shared/config';
import { createGame } from '../shared/seed';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('audio móvil', () => {
  it('activa música y efectos para nuevos dispositivos y conserva silencio/volumen existentes', () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    expect(readPreferences()).toMatchObject({ music: true, effects: true, volume: 0.35 });
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ music: false, effects: false, volume: 0 }),
    );
    expect(readPreferences()).toMatchObject({ music: false, effects: false, volume: 0 });
  });
  it('reutiliza un contexto, recupera suspensión/interrupción y mantiene un único reloj', async () => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    const gains: ReturnType<typeof vi.fn>[] = [];
    class Context {
      static count = 0;
      static instance: Context;
      state = 'suspended';
      currentTime = 0;
      destination = {};
      onstatechange?: () => void;
      constructor() {
        Context.count++;
        Context.instance = this;
      }
      createGain() {
        const target = vi.fn();
        gains.push(target);
        return { connect: vi.fn(), gain: { setTargetAtTime: target } };
      }
      resume = vi.fn(async () => {
        this.state = 'running';
        this.onstatechange?.();
      });
      suspend = vi.fn(async () => {
        this.state = 'suspended';
        this.onstatechange?.();
      });
    }
    vi.stubGlobal('AudioContext', Context);
    const manager = new AudioManager();
    await manager.resume();
    expect(Context.count).toBe(0); // no autoplay before a gesture
    await manager.unlock();
    await manager.unlock();
    manager.sync();
    expect(Context.count).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    manager.stop();
    expect(vi.getTimerCount()).toBe(0);
    await manager.resume();
    expect(manager.unlocked).toBe(true);
    Context.instance.state = 'interrupted';
    await manager.resume();
    expect(Context.count).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ music: false, effects: false, volume: 0.2 }),
    );
    await vi.advanceTimersByTimeAsync(0); // jsdom dispatches storage events on a separate task.
    manager.sync();
    expect(vi.getTimerCount()).toBe(0);
    expect(gains[0]).toHaveBeenLastCalledWith(0, 0, 0.015);
    expect(gains[1]).toHaveBeenLastCalledWith(0, 0, 0.015);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    await manager.unlock();
    expect(Context.count).toBe(1);
    manager.stop();
  });
});
describe('instalación compatible', () => {
  async function setup(ua = 'Mozilla Android Chrome', standalone = false) {
    vi.resetModules();
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
    Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: 5 });
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: false });
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: standalone, addEventListener: vi.fn() })),
    );
    return import('../src/lib/install');
  }
  it('distingue Android, iOS/iPadOS, escritorio y standalone', async () => {
    const api = await setup();
    expect(api.mobilePlatform('Android', 1)).toBe('android');
    expect(api.mobilePlatform('iPhone', 1)).toBe('ios');
    expect(api.mobilePlatform('Macintosh', 5)).toBe('ios');
    expect(api.mobilePlatform('Windows', 0)).toBeNull();
    expect(api.installEligible()).toBe(true);
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
    expect(api.installEligible()).toBe(false);
  });
  it('recuerda descartar, nunca mostrar y cambios de display-mode', async () => {
    const api = await setup();
    api.dismissInstallation();
    expect(api.installEligible()).toBe(false);
    sessionStorage.clear();
    expect(api.installEligible()).toBe(false);
    localStorage.clear();
    api.dismissInstallation(true);
    expect(localStorage.getItem(api.INSTALL_NEVER)).toBe('yes');
    expect(api.installEligible()).toBe(false);
    localStorage.clear();
    sessionStorage.clear();
    const installed = await setup('Android', true);
    expect(installed.installEligible()).toBe(false);
  });
  it('captura el evento temprano pero solo abre el prompt al pulsar y consume el evento', async () => {
    const api = await setup();
    api.captureInstallation();
    const event = new Event('beforeinstallprompt', {
      cancelable: true,
    }) as import('../src/lib/install').InstallEvent;
    event.prompt = vi.fn(async () => {});
    event.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(event.prompt).not.toHaveBeenCalled();
    expect(api.installationSnapshot().event).toBe(event);
    expect(await api.promptInstallation()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(api.installationSnapshot().event).toBeNull();
    window.dispatchEvent(new Event('appinstalled'));
    expect(api.isStandalone()).toBe(true);
  });
});
describe('dos vistas, un acceso de ciudad', () => {
  it('cubre los 15 edificios exactamente una vez con los mismos destinos y obras del club', () => {
    const game = createGame(Date.now(), true),
      club = game.clubs[0];
    expect(CITY_GROUPS.flatMap((g) => g.ids).sort()).toEqual(BUILDINGS.map((b) => b.id).sort());
    for (const b of BUILDINGS) {
      const access = buildingAccess(game, club, b.id);
      expect(access.to).toBe(`/building/${b.id}`);
      expect(access.building).toBe(b);
      expect(access.level).toBe(club.buildings[b.id] || 1);
      expect(access.job).toEqual(
        game.jobs.find((j) => j.clubId === club.id && j.kind === 'building' && j.target === b.id),
      );
    }
  });
  it('recupera únicamente valores conocidos de la preferencia', () => {
    expect(readCityView()).toBe('map');
    localStorage.setItem('monigones-city-view', 'sections');
    expect(readCityView()).toBe('sections');
    localStorage.setItem('monigones-city-view', 'unknown');
    expect(readCityView()).toBe('map');
  });
});
