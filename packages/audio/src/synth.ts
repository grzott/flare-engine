import type { PCMBufferLike } from './audio-manager.js';

export type SynthWaveform = 'sine' | 'square' | 'saw' | 'noise';

export interface SynthEnvelope {
  /** Seconds from silence to full level. */
  attack: number;
  /** Seconds from full level down to `sustain`. */
  decay: number;
  /** Level (0–1) held after the decay until the release starts. */
  sustain: number;
  /** Seconds of fade to silence, counted back from the end of the sound. */
  release: number;
}

export interface SynthSound {
  wave: SynthWaveform;
  /** Hz at the start. Ignored by `noise`. */
  frequency: number;
  /** Hz at the end, reached by a linear sweep from `frequency`. Default: `frequency` (no sweep). */
  endFrequency?: number;
  /** Seconds. */
  duration: number;
  /** Default: `{ attack: 0, decay: 0, sustain: 1, release: 0 }` (flat). */
  envelope?: SynthEnvelope;
  /** Peak amplitude (0–1). Default 1. */
  volume?: number;
  /** 32-bit seed for `noise`; the same seed renders the same samples. Default 1. */
  seed?: number;
}

const TWO_PI = Math.PI * 2;

/** Samples `duration` seconds occupy at `sampleRate`: `ceil(duration * sampleRate)`, 0 for a non-finite or negative duration. */
export function synthSampleCount(duration: number, sampleRate: number): number {
  if (!Number.isFinite(duration) || duration < 0) return 0;
  return Math.ceil(duration * sampleRate);
}

/**
 * Renders `sound` as mono PCM in [-1, 1] into `out` from index 0 and returns the number of samples
 * written: `min(out.length, synthSampleCount(sound.duration, sampleRate))`. Allocates nothing.
 */
export function renderSynth(sound: SynthSound, sampleRate: number, out: Float32Array): number {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) return 0;
  const duration = sound.duration;
  const n = Math.min(out.length, synthSampleCount(duration, sampleRate));
  const wave = sound.wave;
  const volume = sound.volume ?? 1;
  const f0 = sound.frequency;
  const sweep = ((sound.endFrequency ?? f0) - f0) / duration;
  const env = sound.envelope;
  const attack = env ? env.attack : 0;
  const decay = env ? env.decay : 0;
  const sustain = env ? env.sustain : 1;
  const release = env ? env.release : 0;
  const decayEnd = attack + decay;
  const releaseStart = duration - release;
  const dt = 1 / sampleRate;
  let phase = 0;
  let rng = (sound.seed ?? 1) | 0 || 1;

  for (let i = 0; i < n; i++) {
    const t = i * dt;
    let osc: number;
    switch (wave) {
      case 'sine':
        osc = Math.sin(TWO_PI * phase);
        break;
      case 'square':
        osc = phase < 0.5 ? 1 : -1;
        break;
      case 'saw':
        osc = 2 * phase - 1;
        break;
      default:
        rng ^= rng << 13;
        rng ^= rng >>> 17;
        rng ^= rng << 5;
        osc = (rng >>> 0) / 2147483648 - 1;
        break;
    }
    let gain =
      t < attack ? t / attack : t < decayEnd ? 1 - ((1 - sustain) * (t - attack)) / decay : sustain;
    if (release > 0 && t >= releaseStart) gain *= (duration - t) / release;
    out[i] = osc * gain * volume;
    phase += (f0 + sweep * t) * dt;
    if (phase >= 1) phase -= Math.floor(phase);
  }
  return n;
}

/** Copies `pcm` into every channel of `buffer` (a mono render fills a stereo buffer on both sides). */
export function fillPCMBuffer(buffer: PCMBufferLike, pcm: Float32Array): void {
  for (let c = 0; c < buffer.numberOfChannels; c++) buffer.copyToChannel(pcm, c);
}
