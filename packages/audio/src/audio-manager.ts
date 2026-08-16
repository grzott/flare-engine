/**
 * Minimal interfaces for the Web Audio API subset we use.
 * At runtime these are provided by react-native-audio-api.
 */

export interface AudioDestinationNodeLike {
  readonly channelCount: number;
}

export interface GainNodeLike {
  readonly gain: AudioParamLike;
  connect(dest: AudioDestinationNodeLike | GainNodeLike): void;
  disconnect(): void;
}

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): void;
  linearRampToValueAtTime(value: number, time: number): void;
}

export interface AudioBufferLike {
  readonly duration: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  readonly length: number;
}

export interface AudioBufferSourceNodeLike {
  buffer: AudioBufferLike | null;
  loop: boolean;
  /**
   * Playback-rate param (Web Audio shape). Optional — not every injected node
   * exposes it; `SFXPool.play`'s `rate` option is a no-op when this is absent.
   */
  readonly playbackRate?: { value: number };
  connect(dest: GainNodeLike | AudioDestinationNodeLike): void;
  disconnect(): void;
  start(when?: number): void;
  stop(when?: number): void;
  onended: ((this: AudioBufferSourceNodeLike, ev: unknown) => void) | null;
}

export interface AudioContextLike {
  readonly state: 'suspended' | 'running' | 'closed';
  readonly currentTime: number;
  readonly destination: AudioDestinationNodeLike;
  createGain(): GainNodeLike;
  createBufferSource(): AudioBufferSourceNodeLike;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

/** Audio context state. */
export type AudioState = 'uninitialized' | 'running' | 'suspended' | 'closed';

/**
 * AudioManager — manages the AudioContext lifecycle.
 * Wraps react-native-audio-api's AudioContext.
 */
export class AudioManager {
  private ctx: AudioContextLike | null = null;

  /** Current audio state. */
  get state(): AudioState {
    if (!this.ctx) return 'uninitialized';
    return this.ctx.state === 'closed' ? 'closed' : this.ctx.state;
  }

  /** The underlying AudioContext, or null if not initialized. */
  get context(): AudioContextLike | null {
    return this.ctx;
  }

  /** Current time from the AudioContext. */
  get currentTime(): number {
    return this.ctx?.currentTime ?? 0;
  }

  /** Initialize with a factory that creates the native AudioContext. */
  init(factory: () => AudioContextLike): void {
    if (this.ctx) return;
    this.ctx = factory();
  }

  /** Suspend audio. Call from your own background handler — no automatic wiring. */
  async suspend(): Promise<void> {
    if (this.ctx?.state === 'running') {
      await this.ctx.suspend();
    }
  }

  /** Resume audio. Call from your own foreground handler — no automatic wiring. */
  async resume(): Promise<void> {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /** Close and dispose the AudioContext. */
  async close(): Promise<void> {
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
