import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playChime, primeAudio, resetAudioForTests, setSoundEnabled, soundEnabled } from '@/lib/chime';
import { markSwitched, takeSwitchCelebration } from '@/lib/celebrate';

class Memory { m = new Map<string, string>(); getItem(k: string) { return this.m.get(k) ?? null; } setItem(k: string, v: string) { this.m.set(k, v); } removeItem(k: string) { this.m.delete(k); } }
interface Osc { type: string; frequency: { value: number }; started: number | null; stopped: number | null }

function fakeAudio(state: 'running' | 'suspended' = 'running', resumesTo: 'running' | 'suspended' = 'running') {
  const oscs: Osc[] = [];
  let created = 0;
  class FakeAC {
    state = state; currentTime = 10; destination = {};
    constructor() { created++; }
    resume() { this.state = resumesTo; return Promise.resolve(); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
    createOscillator() { const o: Osc & { connect(): void; start(t: number): void; stop(t: number): void } = { type: '', frequency: { value: 0 }, started: null, stopped: null, connect() {}, start(t) { o.started = t; }, stop(t) { o.stopped = t; } }; oscs.push(o); return o; }
  }
  return { FakeAC, oscs, created: () => created };
}

beforeEach(() => { resetAudioForTests(); vi.stubGlobal('localStorage', new Memory()); vi.stubGlobal('sessionStorage', new Memory()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('the celebration chime', () => {
  it('plays a rising arpeggio and a shimmer, each note starting before it stops', async () => {
    const { FakeAC, oscs } = fakeAudio();
    vi.stubGlobal('window', { AudioContext: FakeAC });
    expect(await playChime()).toBe(true);
    expect(oscs).toHaveLength(11); // 4 notes with an overtone each, plus a 3-note shimmer
    const freqs = oscs.map((o) => o.frequency.value);
    expect(freqs).toEqual(expect.arrayContaining([523.25, 659.25, 783.99, 1046.5]));
    for (const o of oscs) { expect(o.started).not.toBeNull(); expect(o.stopped!).toBeGreaterThan(o.started!); }
    const mainStarts = oscs.filter((o) => o.type === 'sine' && o.frequency.value < 1100).map((o) => o.started!);
    expect([...mainStarts].sort((a, b) => a - b)).toEqual(mainStarts); // the notes rise in time
  });
  it('is silent when sound is turned off, and remembers that', async () => {
    const { FakeAC, oscs } = fakeAudio();
    vi.stubGlobal('window', { AudioContext: FakeAC });
    expect(soundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(soundEnabled()).toBe(false);
    expect(await playChime()).toBe(false);
    expect(oscs).toHaveLength(0);
    setSoundEnabled(true);
    expect(await playChime()).toBe(true);
  });
  it('skips quietly when there is no audio, or the browser keeps it blocked', async () => {
    vi.stubGlobal('window', {});
    expect(await playChime()).toBe(false);
    resetAudioForTests();
    const blocked = fakeAudio('suspended', 'suspended');
    vi.stubGlobal('window', { AudioContext: blocked.FakeAC });
    expect(await playChime()).toBe(false);
    expect(blocked.oscs).toHaveLength(0);
    resetAudioForTests();
    const wakes = fakeAudio('suspended', 'running');
    vi.stubGlobal('window', { AudioContext: wakes.FakeAC });
    expect(await playChime()).toBe(true);
  });
  it('uses one audio context however often it is primed', () => {
    const { FakeAC, created } = fakeAudio();
    vi.stubGlobal('window', { AudioContext: FakeAC });
    primeAudio(); primeAudio(); primeAudio();
    expect(created()).toBe(1);
  });
});

describe('the switch celebration', () => {
  it('needs the switch button first: arriving any other way does not celebrate', () => {
    expect(takeSwitchCelebration()).toBe(false);
  });
  it('celebrates once for each switch, and wakes the audio on the click', () => {
    const { FakeAC, created } = fakeAudio();
    vi.stubGlobal('window', { AudioContext: FakeAC });
    markSwitched();
    expect(created()).toBe(1);
    expect(takeSwitchCelebration()).toBe(true);
    expect(takeSwitchCelebration()).toBe(false); // the note was used up
  });
  it('does not repeat within a week, however many times someone switches', () => {
    markSwitched(); expect(takeSwitchCelebration()).toBe(true);
    markSwitched(); expect(takeSwitchCelebration()).toBe(false);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 24 * 60 * 60 * 1000);
    markSwitched(); expect(takeSwitchCelebration()).toBe(true);
    vi.useRealTimers();
  });
});
