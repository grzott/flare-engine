import type { AudioBufferLike, AudioContextLike } from '@flare-engine/engine';

interface AudioBufferFillable extends AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}
interface AudioContextWithCreateBuffer extends AudioContextLike {
  createBuffer(numChannels: number, length: number, sampleRate: number): AudioBufferFillable;
}

export type SfxKey = 'shoot' | 'hit' | 'explode' | 'bomb' | 'shard';

type WaveShape = 'sine' | 'square' | 'saw' | 'noise';
type EnvShape = 'linear' | 'exp-fast' | 'exp-slow';

interface BeepSpec {
  freqStart: number;
  freqEnd: number;
  duration: number;
  volume: number;
  wave: WaveShape;
  env: EnvShape;
}

const SFX_SPECS: Record<SfxKey, BeepSpec> = {
  shoot: {
    freqStart: 960,
    freqEnd: 520,
    duration: 0.06,
    volume: 0.22,
    wave: 'square',
    env: 'exp-fast',
  },
  hit: {
    freqStart: 260,
    freqEnd: 80,
    duration: 0.09,
    volume: 0.45,
    wave: 'saw',
    env: 'exp-fast',
  },
  explode: {
    freqStart: 200,
    freqEnd: 30,
    duration: 0.4,
    volume: 0.55,
    wave: 'noise',
    env: 'exp-slow',
  },
  bomb: {
    freqStart: 140,
    freqEnd: 18,
    duration: 0.75,
    volume: 0.75,
    wave: 'noise',
    env: 'exp-slow',
  },
  shard: {
    freqStart: 880,
    freqEnd: 1760,
    duration: 0.28,
    volume: 0.35,
    wave: 'sine',
    env: 'exp-slow',
  },
};

function envelope(tn: number, shape: EnvShape): number {
  if (shape === 'linear') return Math.max(0, 1 - tn);
  if (shape === 'exp-fast') return Math.exp(-tn * 5);
  return Math.exp(-tn * 2.2);
}

function sampleWave(wave: WaveShape, phase: number): number {
  if (wave === 'sine') return Math.sin(phase);
  if (wave === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
  if (wave === 'saw') return ((phase / Math.PI) % 2) - 1;
  return Math.random() * 2 - 1;
}

function renderBeep(buf: AudioBufferFillable, spec: BeepSpec): void {
  const data = buf.getChannelData(0);
  const n = buf.length;
  const sr = buf.sampleRate;
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const tn = t / spec.duration;
    const freq = spec.freqStart + (spec.freqEnd - spec.freqStart) * tn;
    phase += (freq * 2 * Math.PI) / sr;
    data[i] = sampleWave(spec.wave, phase) * envelope(tn, spec.env) * spec.volume;
  }
}

export function createSfxBuffers(ctx: AudioContextLike): Record<SfxKey, AudioBufferLike> {
  const full = ctx as AudioContextWithCreateBuffer;
  const sr = 44100;
  const out = {} as Record<SfxKey, AudioBufferLike>;
  for (const key of Object.keys(SFX_SPECS) as SfxKey[]) {
    const spec = SFX_SPECS[key];
    const len = Math.floor(spec.duration * sr);
    const buf = full.createBuffer(1, len, sr);
    renderBeep(buf, spec);
    out[key] = buf;
  }
  return out;
}

// ---- Music tracks — one per zone (§5) --------------------------------------

export type MusicKey = 'zone1' | 'zone2' | 'zone3' | 'zone4' | 'zone5' | 'zone6';

interface MusicTrack {
  bpm: number;
  beats: number;
  bassNotes: number[];
  leadNotes: number[];
  leadWave: WaveShape;
  bassWave: WaveShape;
  gain: number;
}

const FREQ_A4 = 440;
const MIDI_A4 = 69;
const midiToFreq = (midi: number): number => FREQ_A4 * 2 ** ((midi - MIDI_A4) / 12);

// Zone 1 — sparse baroque (minor, slower, sine lead + square bass).
// Zone 2 — folk percussion + flute (faster, saw bass pulses + square lead).
const TRACKS: Record<MusicKey, MusicTrack> = {
  zone1: {
    bpm: 88,
    beats: 16,
    bassNotes: [45, 45, 43, 43, 48, 48, 47, 47, 45, 45, 43, 43, 50, 50, 48, 48],
    leadNotes: [69, 72, 76, 72, 69, 74, 77, 74, 69, 72, 76, 74, 72, 69, 67, 65],
    leadWave: 'sine',
    bassWave: 'square',
    gain: 0.22,
  },
  zone2: {
    bpm: 132,
    beats: 16,
    bassNotes: [40, 40, 45, 45, 43, 43, 48, 48, 40, 40, 45, 45, 43, 43, 47, 47],
    leadNotes: [65, 67, 69, 72, 69, 67, 65, 64, 65, 67, 69, 72, 74, 72, 69, 67],
    leadWave: 'square',
    bassWave: 'saw',
    gain: 0.28,
  },
  // Zone 3 — slow sine drones over the Wisła: long-breath pad, deep bass.
  zone3: {
    bpm: 60,
    beats: 16,
    bassNotes: [36, 36, 36, 36, 38, 38, 38, 38, 41, 41, 41, 41, 36, 36, 36, 36],
    leadNotes: [60, 62, 64, 65, 64, 62, 60, 59, 60, 62, 64, 67, 65, 64, 62, 60],
    leadWave: 'sine',
    bassWave: 'sine',
    gain: 0.2,
  },
  // Zone 4 — Łęczyckie Błota: low dissonant brass, square lead over saw bass,
  // minor intervals and bent phrasing to evoke the swamp.
  zone4: {
    bpm: 72,
    beats: 16,
    bassNotes: [33, 33, 32, 32, 36, 36, 33, 33, 34, 34, 33, 33, 37, 37, 34, 34],
    leadNotes: [57, 58, 60, 58, 57, 55, 53, 55, 57, 58, 60, 61, 60, 58, 57, 55],
    leadWave: 'square',
    bassWave: 'saw',
    gain: 0.26,
  },
  // Zone 5 — Łysa Góra: ritual choir. Slow 54 bpm sine drone/pad over sine
  // sub-bass, D-minor voicings (D/F/A) to evoke the sabbath.
  zone5: {
    bpm: 54,
    beats: 16,
    bassNotes: [38, 38, 38, 38, 41, 41, 41, 41, 45, 45, 45, 45, 38, 38, 38, 38],
    leadNotes: [62, 65, 69, 65, 62, 65, 69, 72, 69, 65, 62, 65, 69, 65, 62, 60],
    leadWave: 'sine',
    bassWave: 'sine',
    gain: 0.22,
  },
  // Zone 6 — Katakumby: gothic organ drone. Very slow 48 bpm, sine lead over
  // sine sub, D-minor with a lowered-2 (E♭) to evoke crypt/basilisk.
  zone6: {
    bpm: 48,
    beats: 16,
    bassNotes: [26, 26, 26, 26, 29, 29, 29, 29, 27, 27, 27, 27, 26, 26, 26, 26],
    leadNotes: [50, 53, 57, 53, 50, 53, 56, 53, 50, 51, 53, 51, 50, 48, 50, 48],
    leadWave: 'sine',
    bassWave: 'sine',
    gain: 0.24,
  },
};

function renderMusic(buf: AudioBufferFillable, track: MusicTrack): void {
  const data = buf.getChannelData(0);
  const n = buf.length;
  const sr = buf.sampleRate;
  const beatSec = 60 / track.bpm;
  let leadPhase = 0;
  let bassPhase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const beatIdx = Math.min(track.beats - 1, Math.floor(t / beatSec));
    const beatT = (t % beatSec) / beatSec;
    const leadFreq = midiToFreq(track.leadNotes[beatIdx] ?? 69);
    const bassFreq = midiToFreq(track.bassNotes[beatIdx] ?? 45);
    leadPhase += (leadFreq * 2 * Math.PI) / sr;
    bassPhase += (bassFreq * 2 * Math.PI) / sr;
    const leadEnv = Math.exp(-beatT * 3) * 0.6;
    const bassEnv = Math.exp(-beatT * 1.8) * 0.8;
    const lead = sampleWave(track.leadWave, leadPhase) * leadEnv;
    const bass = sampleWave(track.bassWave, bassPhase) * bassEnv;
    data[i] = (lead + bass) * 0.5 * track.gain;
  }
}

export function createMusicBuffers(ctx: AudioContextLike): Record<MusicKey, AudioBufferLike> {
  const full = ctx as AudioContextWithCreateBuffer;
  const sr = 22050;
  const out = {} as Record<MusicKey, AudioBufferLike>;
  for (const key of Object.keys(TRACKS) as MusicKey[]) {
    const track = TRACKS[key];
    const totalSec = (track.beats * 60) / track.bpm;
    const len = Math.floor(totalSec * sr);
    const buf = full.createBuffer(1, len, sr);
    renderMusic(buf, track);
    out[key] = buf;
  }
  return out;
}
