import { describe, expect, it } from 'bun:test';
import type { AudioContextLike, PCMBufferLike } from '../src/audio-manager.js';
import {
  fillPCMBuffer,
  renderSynth,
  type SynthSound,
  type SynthWaveform,
  synthSampleCount,
} from '../src/synth.js';

const RATE = 44100;

function render(sound: SynthSound, rate = RATE): Float32Array {
  const out = new Float32Array(synthSampleCount(sound.duration, rate));
  renderSynth(sound, rate, out);
  return out;
}

/** Rising zero crossings in `pcm[from, to)`. */
function risingCrossings(pcm: Float32Array, from = 1, to = pcm.length): number {
  let count = 0;
  for (let i = Math.max(from, 1); i < to; i++) {
    if ((pcm[i - 1] ?? 0) < 0 && (pcm[i] ?? 0) >= 0) count++;
  }
  return count;
}

function peak(pcm: Float32Array, from = 0, to = pcm.length): number {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(pcm[i] ?? 0));
  return max;
}

describe('synthSampleCount', () => {
  it('scales duration by the sample rate, rounding up', () => {
    expect(synthSampleCount(1, 44100)).toBe(44100);
    expect(synthSampleCount(0.5, 8000)).toBe(4000);
    expect(synthSampleCount(0.00001, 44100)).toBe(1);
  });

  it('is 0 for a non-finite or negative duration', () => {
    expect(synthSampleCount(Number.NaN, 44100)).toBe(0);
    expect(synthSampleCount(-1, 44100)).toBe(0);
    expect(synthSampleCount(Number.POSITIVE_INFINITY, 44100)).toBe(0);
  });
});

describe('renderSynth', () => {
  it('renders a sine at the requested frequency', () => {
    const pcm = render({ wave: 'sine', frequency: 440, duration: 1 });
    const crossings = risingCrossings(pcm);
    expect(crossings).toBeGreaterThanOrEqual(439);
    expect(crossings).toBeLessThanOrEqual(441);
    expect(Math.abs(peak(pcm) - 1)).toBeLessThan(0.01);
    expect(pcm[0]).toBe(0);
  });

  it('applies the ADSR envelope and volume', () => {
    const pcm = render({
      wave: 'sine',
      frequency: 100,
      duration: 1,
      volume: 0.8,
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.2 },
    });
    expect(Math.abs(peak(pcm) - 0.8)).toBeLessThan(0.02);
    expect(Math.abs(peak(pcm, 0.3 * RATE, 0.7 * RATE) - 0.4)).toBeLessThan(0.02);
    expect(Math.abs(pcm[pcm.length - 1] ?? 1)).toBeLessThan(0.01);
    expect(peak(pcm, pcm.length - Math.floor(0.01 * RATE))).toBeLessThan(0.05);
  });

  it('sweeps linearly from frequency to endFrequency', () => {
    const pcm = render({ wave: 'sine', frequency: 220, endFrequency: 880, duration: 1 });
    const window = Math.floor(0.1 * RATE);
    const first = risingCrossings(pcm, 0, window);
    const last = risingCrossings(pcm, pcm.length - window);
    expect(first).toBeGreaterThanOrEqual(23);
    expect(first).toBeLessThanOrEqual(27);
    expect(last).toBeGreaterThanOrEqual(82);
    expect(last).toBeLessThanOrEqual(87);
  });

  it('treats a missing endFrequency as no sweep', () => {
    const plain = render({ wave: 'saw', frequency: 330, duration: 0.2 });
    const explicit = render({ wave: 'saw', frequency: 330, endFrequency: 330, duration: 0.2 });
    expect(plain).toEqual(explicit);
  });

  it('keeps square, saw and noise inside [-1, 1]', () => {
    for (const wave of ['square', 'saw', 'noise'] as const) {
      const pcm = render({ wave, frequency: 100, duration: 0.1 });
      expect(peak(pcm)).toBeLessThanOrEqual(1);
    }
  });

  it('renders a square as only ±volume', () => {
    const pcm = render({ wave: 'square', frequency: 100, duration: 0.1, volume: 0.5 });
    for (const s of pcm) expect(Math.abs(s)).toBeCloseTo(0.5, 6);
  });

  it('renders a saw rising within a cycle', () => {
    const pcm = render({ wave: 'saw', frequency: 100, duration: 0.1 });
    for (let i = 1; i < 50; i++) {
      expect(pcm[i]).toBeGreaterThan(pcm[i - 1] ?? Number.POSITIVE_INFINITY);
    }
  });

  it('renders noise deterministically per seed', () => {
    const a = render({ wave: 'noise', frequency: 0, duration: 0.05, seed: 7 });
    const b = render({ wave: 'noise', frequency: 0, duration: 0.05, seed: 7 });
    const c = render({ wave: 'noise', frequency: 0, duration: 0.05, seed: 8 });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(peak(a)).toBeGreaterThan(0);
  });

  it('writes only as many samples as out holds', () => {
    const out = new Float32Array(100);
    expect(renderSynth({ wave: 'sine', frequency: 440, duration: 1 }, RATE, out)).toBe(100);
    expect(peak(out)).toBeGreaterThan(0);
  });

  it('returns 0 for a non-positive or non-finite sampleRate', () => {
    const out = new Float32Array(10);
    const sound: SynthSound = { wave: 'sine', frequency: 440, duration: 1 };
    expect(renderSynth(sound, 0, out)).toBe(0);
    expect(renderSynth(sound, -1, out)).toBe(0);
    expect(renderSynth(sound, Number.NaN, out)).toBe(0);
    expect(peak(out)).toBe(0);
  });

  it('allocates nothing beyond the caller buffer', () => {
    const out = new Float32Array(4410);
    const waves: SynthWaveform[] = ['sine', 'square', 'saw', 'noise'];
    const sounds = waves.map(
      (wave): SynthSound => ({
        wave,
        frequency: 220,
        endFrequency: 880,
        duration: 0.1,
        seed: 3,
        envelope: { attack: 0.01, decay: 0.02, sustain: 0.6, release: 0.03 },
      }),
    );
    for (const sound of sounds) {
      for (let i = 0; i < 200; i++) renderSynth(sound, RATE, out);
    }

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (const sound of sounds) {
      for (let i = 0; i < 2_000; i++) renderSynth(sound, RATE, out);
    }
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
  });
});

describe('fillPCMBuffer', () => {
  it('copies the pcm into every channel', () => {
    const calls: [Float32Array, number, number | undefined][] = [];
    const buffer: PCMBufferLike = {
      duration: 0.01,
      numberOfChannels: 2,
      sampleRate: RATE,
      length: 441,
      copyToChannel(source, channel, start) {
        calls.push([source, channel, start]);
      },
    };
    const pcm = new Float32Array(441);
    fillPCMBuffer(buffer, pcm);
    expect(calls).toEqual([
      [pcm, 0, undefined],
      [pcm, 1, undefined],
    ]);
  });

  it('keeps a context without createBuffer type-checking', () => {
    const ctx: AudioContextLike = {
      state: 'running',
      currentTime: 0,
      destination: { channelCount: 2 },
      createGain() {
        return {
          gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} },
          connect() {},
          disconnect() {},
        };
      },
      createBufferSource() {
        return {
          buffer: null,
          loop: false,
          connect() {},
          disconnect() {},
          start() {},
          stop() {},
          onended: null,
        };
      },
      resume: () => Promise.resolve(),
      suspend: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };
    const out = new Float32Array(441);
    expect(renderSynth({ wave: 'sine', frequency: 440, duration: 0.01 }, RATE, out)).toBe(441);
    expect(ctx.createBuffer).toBeUndefined();
    expect(ctx.createBuffer?.(1, out.length, RATE)).toBeUndefined();
  });
});
