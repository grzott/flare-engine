import type {
  AudioBufferLike,
  AudioBufferSourceNodeLike,
  AudioContextLike,
  GainNodeLike,
} from './audio-manager.js';

/**
 * Music player — one track at a time, with crossfade support.
 * Loops by default.
 */
export class Music {
  private ctx: AudioContextLike | null = null;
  private output: GainNodeLike | null = null;
  private buffers = new Map<string, AudioBufferLike>();
  private currentSource: AudioBufferSourceNodeLike | null = null;
  private currentGain: GainNodeLike | null = null;
  private currentName: string | null = null;

  /** Name of the currently playing track, or null. */
  get playing(): string | null {
    return this.currentName;
  }

  /** Connect to an AudioContext and output gain node. */
  connect(ctx: AudioContextLike, output: GainNodeLike): void {
    this.ctx = ctx;
    this.output = output;
  }

  /** Register a music track buffer. */
  register(name: string, buffer: AudioBufferLike): void {
    this.buffers.set(name, buffer);
  }

  /** Play a track. Stops any currently playing track. Loops by default. */
  play(name: string, loop = true): void {
    if (!this.ctx || !this.output) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    this.stopInternal();

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gain = this.ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(this.output);

    source.start();
    this.currentSource = source;
    this.currentGain = gain;
    this.currentName = name;

    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
        this.currentGain = null;
        this.currentName = null;
      }
      gain.disconnect();
    };
  }

  /** Stop the current track. */
  stop(): void {
    this.stopInternal();
  }

  /**
   * Crossfade to another track over duration seconds.
   * Fades out current and fades in the new track simultaneously.
   */
  crossfadeTo(name: string, duration: number, loop = true): void {
    if (!this.ctx || !this.output) return;
    const buffer = this.buffers.get(name);
    if (!buffer) return;

    const now = this.ctx.currentTime;

    // Fade out current
    if (this.currentGain && this.currentSource) {
      const oldGain = this.currentGain;
      const oldSource = this.currentSource;
      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + duration);
      // Schedule stop after fade
      try {
        oldSource.stop(now + duration);
      } catch {
        // Already stopped
      }
    }

    // Start new track fading in
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + duration);
    source.connect(gain);
    gain.connect(this.output);

    source.start();
    this.currentSource = source;
    this.currentGain = gain;
    this.currentName = name;

    source.onended = () => {
      if (this.currentSource === source) {
        this.currentSource = null;
        this.currentGain = null;
        this.currentName = null;
      }
      gain.disconnect();
    };
  }

  private stopInternal(): void {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        // Already stopped
      }
    }
    if (this.currentGain) {
      this.currentGain.disconnect();
    }
    this.currentSource = null;
    this.currentGain = null;
    this.currentName = null;
  }
}
