export type Preferences = {
  music: boolean;
  effects: boolean;
  volume: number;
  quality: 'high' | 'medium' | 'low';
  motion: boolean;
};
export const DEFAULT_PREFERENCES: Preferences = {
  music: false,
  effects: true,
  volume: 0.35,
  quality: 'high',
  motion: true,
};
export const PREFERENCES_KEY = 'monigones-preferences-v1';
export function readPreferences(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}');
    return {
      music: typeof p.music === 'boolean' ? p.music : false,
      effects: typeof p.effects === 'boolean' ? p.effects : true,
      volume:
        typeof p.volume === 'number' && Number.isFinite(p.volume)
          ? Math.max(0, Math.min(1, p.volume))
          : 0.35,
      quality: ['high', 'medium', 'low'].includes(p.quality) ? p.quality : 'high',
      motion: typeof p.motion === 'boolean' ? p.motion : true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
export type Sound =
  | 'tap'
  | 'open'
  | 'transfer'
  | 'reward'
  | 'coins'
  | 'construction'
  | 'research'
  | 'level'
  | 'notification'
  | 'goal'
  | 'stadium'
  | 'victory'
  | 'defeat'
  | 'substitution'
  | 'scandal'
  | 'sponsor'
  | 'concert';
const motifs: Record<Sound, number[]> = {
  tap: [660],
  open: [330, 495],
  transfer: [392, 494, 587, 784],
  reward: [523, 659, 784, 1047],
  coins: [1200, 1600, 1900],
  construction: [110, 165, 110],
  research: [349, 523, 698, 1047],
  level: [392, 523, 659, 784, 1047],
  notification: [659, 523],
  goal: [196, 392, 494, 587, 784, 988],
  stadium: [130, 196, 261],
  victory: [392, 523, 659, 784, 659, 1047],
  defeat: [392, 330, 261],
  substitution: [440, 554, 440],
  scandal: [147, 139, 110],
  sponsor: [440, 554, 659, 880],
  concert: [262, 330, 392, 523],
};
/** Música y efectos originales por síntesis; no descargas ni muestras de terceros. */
class AudioManager {
  private context?: AudioContext;
  private effectsBus?: GainNode;
  private musicBus?: GainNode;
  private voices = 0;
  private interval?: number;
  private beat = 0;
  private mode = 'city';
  private last = 0;
  get unlocked() {
    return this.context?.state === 'running';
  }
  async unlock() {
    const Audio =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return;
    try {
      if (!this.context) {
        this.context = new Audio();
        this.effectsBus = this.context.createGain();
        this.musicBus = this.context.createGain();
        this.effectsBus.connect(this.context.destination);
        this.musicBus.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
      this.sync();
    } catch {
      /* Navegador sin salida de audio: la interfaz sigue disponible. */
    }
  }
  private tone(
    frequency: number,
    at: number,
    length: number,
    gain: number,
    type: OscillatorType = 'sine',
    channel: 'music' | 'effects' = 'effects',
  ) {
    if (!this.context || this.voices >= 12 || gain <= 0) return;
    const c = this.context,
      oscillator = c.createOscillator(),
      volume = c.createGain();
    this.voices++;
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    volume.gain.setValueAtTime(0, at);
    volume.gain.linearRampToValueAtTime(gain, at + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, at + length);
    oscillator.connect(volume);
    volume.connect((channel === 'music' ? this.musicBus : this.effectsBus)!);
    oscillator.start(at);
    oscillator.stop(at + length + 0.01);
    oscillator.onended = () => {
      this.voices--;
      oscillator.disconnect();
      volume.disconnect();
    };
  }
  private crowd() {
    if (!this.context || this.voices >= 12) return;
    const c = this.context,
      buffer = c.createBuffer(1, Math.ceil(c.sampleRate * 1.4), c.sampleRate),
      samples = buffer.getChannelData(0);
    let smooth = 0;
    for (let i = 0; i < samples.length; i++) {
      smooth = (smooth + (Math.random() * 2 - 1) * 0.035) / 1.035;
      samples[i] = smooth * 3;
    }
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, c.currentTime + 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.4);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effectsBus!);
    source.start();
    this.voices++;
    source.onended = () => {
      this.voices--;
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  play(sound: Sound) {
    const p = readPreferences();
    if (
      !p.effects ||
      p.volume <= 0 ||
      !this.unlocked ||
      document.hidden ||
      performance.now() - this.last < 45
    )
      return;
    this.last = performance.now();
    if (['goal', 'stadium', 'victory'].includes(sound)) this.crowd();
    motifs[sound].forEach((note, index) =>
      this.tone(
        note,
        this.context!.currentTime + index * 0.075,
        sound === 'tap' ? 0.07 : 0.2,
        0.11,
        sound === 'construction' ? 'triangle' : 'sine',
      ),
    );
  }
  setMode(mode: string) {
    this.mode = mode;
  }
  sync() {
    const p = readPreferences();
    if (this.context) {
      this.effectsBus?.gain.setTargetAtTime(
        p.effects ? p.volume : 0,
        this.context.currentTime,
        0.015,
      );
      this.musicBus?.gain.setTargetAtTime(p.music ? p.volume : 0, this.context.currentTime, 0.015);
    }
    if (this.interval) window.clearInterval(this.interval);
    this.interval = undefined;
    if (document.hidden) {
      void this.context?.suspend();
      return;
    }
    if (!p.music || !this.unlocked) return;
    this.interval = window.setInterval(() => {
      const p = readPreferences();
      if (!p.music || !this.unlocked || document.hidden) return;
      const chords =
        this.mode === 'matchday'
          ? [196, 261.63, 293.66, 261.63]
          : this.mode === 'concert'
            ? [220, 293.66, 349.23, 261.63]
            : [130.81, 174.61, 146.83, 196];
      const root = chords[Math.floor(this.beat / 8) % 4],
        t = this.context!.currentTime;
      if (this.beat % 4 === 0)
        [1, 1.5, 2].forEach((n) => this.tone(root * n, t, 2.1, 0.014, 'triangle', 'music'));
      this.tone(
        root * [2, 3, 2.5, 4, 3, 2.5, 2, 3][this.beat % 8],
        t,
        0.65,
        0.025,
        'sine',
        'music',
      );
      if (this.mode !== 'city' && this.beat % 2 === 0)
        this.tone(70, t, 0.12, 0.025, 'triangle', 'music');
      this.beat++;
    }, 390);
  }
  stop() {
    if (this.interval) window.clearInterval(this.interval);
    this.interval = undefined;
    void this.context?.suspend();
  }
}
export const audioManager = new AudioManager();
export function savePreferences(p: Preferences) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(p));
  } catch {
    /* Preferencias en memoria del formulario. */
  }
  window.dispatchEvent(new Event('monigones:preferences'));
  audioManager.sync();
}
export function emitFeedback(kind: Sound, title?: string) {
  audioManager.play(kind);
  window.dispatchEvent(new CustomEvent('monigones:feedback', { detail: { kind, title } }));
}
