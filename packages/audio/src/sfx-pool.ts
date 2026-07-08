import type { AudioBufferLike, AudioContextLike, GainNodeLike } from './audio-manager.js';

/** Options for playing a sound effect. */
export interface PlaySFXOptions {
  /** Playback volume (0-1). Default: 1. */
  volume?: number;
  /** Playback rate multiplier. Default: 1. Applied only when the audio node exposes a `playbackRate` param. */
  rate?: number;
  /** Whether to loop. Default: false. */
  loop?: boolean;
}

/** A handle to a playing SFX instance. */
export interface SFXHandle {
  /** Stop playback. */
  stop(): void;
}

/** Tracks an active playing source. */
interface ActiveSource {
  name: string;
  stop(): void;
}

/**
 * SFX pool — pre-decoded audio buffers with polyphony management.
 * When max polyphony is reached, the oldest sound is killed.
 */
export class SFXPool {
  private buffers = new Map<string, AudioBufferLike>();
  private active: ActiveSource[] = [];
  private ctx: AudioContextLike | null = null;
  private output: GainNodeLike | null = null;
  private maxPolyphony: number;

  constructor(maxPolyphony = 16) {
    if (maxPolyphony <= 0) throw new Error('SFXPool: maxPolyphony must be > 0');
    this.maxPolyphony = maxPolyphony;
  }

  /** Connect to an AudioContext and output GainNode. */
  connect(ctx: AudioContextLike, output: GainNodeLike): void {
    this.ctx = ctx;
    this.output = output;
  }

  /** Register a pre-decoded audio buffer. */
  register(name: string, buffer: AudioBufferLike): void {
    this.buffers.set(name, buffer);
  }

  /** Unregister a buffer. */
  unregister(name: string): void {
    this.buffers.delete(name);
  }

  /** Check if a buffer is registered. */
  has(name: string): boolean {
    return this.buffers.has(name);
  }

  /** Number of registered buffers. */
  get size(): number {
    return this.buffers.size;
  }

  /** Number of currently active sounds. */
  get activeCount(): number {
    return this.active.length;
  }

  /** Play a registered sound. Returns a handle, or null if not registered/no context. */
  play(name: string, opts?: PlaySFXOptions): SFXHandle | null {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.ctx || !this.output) return null;

    // Kill oldest if at max polyphony
    while (this.active.length >= this.maxPolyphony) {
      const oldest = this.active.shift();
      oldest?.stop();
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = opts?.loop ?? false;

    // Apply playback rate when the injected node exposes the param (Web Audio shape).
    const rateParam = source.playbackRate;
    if (rateParam && opts?.rate !== undefined) {
      rateParam.value = opts.rate;
    }

    // Create a per-source gain for volume control
    const gain = this.ctx.createGain();
    gain.gain.value = opts?.volume ?? 1;
    source.connect(gain);
    gain.connect(this.output);

    const entry: ActiveSource = {
      name,
      stop() {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
        gain.disconnect();
      },
    };

    this.active.push(entry);

    // Clean up when playback ends
    source.onended = () => {
      const idx = this.active.indexOf(entry);
      if (idx !== -1) {
        this.active.splice(idx, 1);
      }
      gain.disconnect();
    };

    source.start();

    return {
      stop: () => {
        entry.stop();
        const idx = this.active.indexOf(entry);
        if (idx !== -1) {
          this.active.splice(idx, 1);
        }
      },
    };
  }

  /** Stop all active sounds. */
  stopAll(): void {
    for (const entry of this.active) {
      entry.stop();
    }
    this.active.length = 0;
  }
}
