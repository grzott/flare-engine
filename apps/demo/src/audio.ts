import type { AudioBufferLike, AudioContextLike } from '@flare-engine/engine';

interface AudioBufferFillable extends AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}

interface AudioContextWithCreateBuffer extends AudioContextLike {
  createBuffer(numChannels: number, length: number, sampleRate: number): AudioBufferFillable;
}

export type BeepKey = 'shoot' | 'hit' | 'explode' | 'bomb';

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

const specs: Record<BeepKey, BeepSpec> = {
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

export function createBeepBuffers(ctx: AudioContextLike): Record<BeepKey, AudioBufferLike> {
  const full = ctx as AudioContextWithCreateBuffer;
  const sr = 44100;
  const out = {} as Record<BeepKey, AudioBufferLike>;
  for (const key of Object.keys(specs) as BeepKey[]) {
    const spec = specs[key];
    const len = Math.floor(spec.duration * sr);
    const buf = full.createBuffer(1, len, sr);
    renderBeep(buf, spec);
    out[key] = buf;
  }
  return out;
}

export type MusicKey = 'menu' | 'game';

interface MusicTrack {
  bpm: number;
  beats: number;
  bassNotes: number[];
  leadNotes: number[];
  leadWave: WaveShape;
  bassWave: WaveShape;
  gain: number;
}

const MIDI_A4 = 69;
const FREQ_A4 = 440;
const midiToFreq = (midi: number): number => FREQ_A4 * 2 ** ((midi - MIDI_A4) / 12);

const tracks: Record<MusicKey, MusicTrack> = {
  menu: {
    bpm: 96,
    beats: 16,
    bassNotes: [45, 45, 43, 43, 48, 48, 47, 47, 45, 45, 43, 43, 50, 50, 48, 48],
    leadNotes: [69, 72, 76, 72, 69, 74, 77, 74, 69, 72, 76, 74, 72, 69, 67, 65],
    leadWave: 'sine',
    bassWave: 'square',
    gain: 0.22,
  },
  game: {
    bpm: 148,
    beats: 16,
    bassNotes: [40, 40, 40, 43, 38, 38, 38, 41, 40, 40, 40, 47, 45, 43, 40, 40],
    leadNotes: [64, 67, 71, 72, 71, 67, 64, 67, 69, 71, 72, 74, 71, 67, 64, 62],
    leadWave: 'square',
    bassWave: 'saw',
    gain: 0.32,
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
  for (const key of Object.keys(tracks) as MusicKey[]) {
    const track = tracks[key];
    const totalSec = (track.beats * 60) / track.bpm;
    const len = Math.floor(totalSec * sr);
    const buf = full.createBuffer(1, len, sr);
    renderMusic(buf, track);
    out[key] = buf;
  }
  return out;
}
