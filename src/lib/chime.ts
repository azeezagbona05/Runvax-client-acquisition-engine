/**
 * A short celebratory chime, made in the browser with the Web Audio API, so there is no sound file to load.
 *
 * Browsers only let a page make sound after the person has interacted with it, so `primeAudio()` is called from the click
 * that starts a celebration (the click on "Switch to RUNVAX 2.0"). The same audio context then keeps working after the
 * page changes, because the move into the new experience happens without a full reload. If the browser still says no, the
 * chime is skipped quietly: the celebration looks the same, just silent. Sound can be turned off, and that is remembered.
 */

const KEY = 'runvax_sound';
type AC = typeof AudioContext;
let ctx: AudioContext | null = null;

const ctor = (): AC | null => {
  if (typeof window === 'undefined') return null;
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext ?? null;
};

export function soundEnabled(): boolean {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}
export function setSoundEnabled(on: boolean): void {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* not remembered */ }
}

/** Call from a click or tap. Creates (or wakes) the audio context so a chime can play a moment later. */
export function primeAudio(): void {
  try {
    const C = ctor();
    if (!C) return;
    ctx ??= new C();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* no audio available */ }
}

/** C major, rising: C5, E5, G5, C6, then a soft shimmer chord. Gentle volume. Resolves true if it played. */
const NOTES = [523.25, 659.25, 783.99, 1046.5];
const SHIMMER = [1318.51, 1567.98, 2093];

export async function playChime(): Promise<boolean> {
  if (!soundEnabled()) return false;
  try {
    primeAudio();
    const c = ctx;
    if (!c) return false;
    if (c.state === 'suspended') await c.resume();
    if (c.state !== 'running') return false;
    const t0 = c.currentTime + 0.03;
    const master = c.createGain();
    master.gain.value = 0.16;
    master.connect(c.destination);
    const tone = (freq: number, at: number, len: number, peak: number, type: OscillatorType) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.linearRampToValueAtTime(peak, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g); g.connect(master);
      osc.start(at); osc.stop(at + len + 0.05);
    };
    NOTES.forEach((f, i) => { tone(f, t0 + i * 0.11, 0.9, 0.9, 'sine'); tone(f * 2, t0 + i * 0.11, 0.5, 0.18, 'triangle'); });
    SHIMMER.forEach((f, i) => tone(f, t0 + 0.5 + i * 0.04, 1.3, 0.35, 'sine'));
    return true;
  } catch { return false; }
}

/** Test helper: forget the audio context. */
export function resetAudioForTests(): void { ctx = null; }
