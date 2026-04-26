import type {
  AudioContextLike,
  GameContextValue,
  Music as MusicT,
  SFXPool as SFXPoolT,
} from '@flare-engine/engine';
import { Music, SFXPool, createChannels } from '@flare-engine/engine';
import { AUDIO_MANIFEST, loadMusicBuffers, loadSfxBuffers } from '../assets';
import { resetSfxThrottle } from './sfx';

interface AudioApiModule {
  AudioContext: new () => AudioContextLike;
}

export interface AudioHandles {
  pool: SFXPoolT;
  music: MusicT;
  channels: ReturnType<typeof createChannels>;
}

/** Process-scoped handles. A single audio graph is constructed per process;
 *  subsequent `initAudio` calls return the cached handles. This is critical
 *  on Android — each new AudioContext opens an audio session, and the OS
 *  eventually mutes / gates further sessions after enough background cycles. */
let cached: AudioHandles | null = null;
let pending: Promise<AudioHandles | null> | null = null;

/**
 * Initialize the audio subsystem: dynamically imports `react-native-audio-api`,
 * builds channels, registers procedurally synthesized SFX + music buffers.
 * Idempotent — concurrent or repeat calls reuse the existing graph.
 */
export async function initAudio(ctx: GameContextValue): Promise<AudioHandles | null> {
  if (cached) return cached;
  if (pending) return pending;
  pending = (async () => {
    try {
      const mod = (await import('react-native-audio-api')) as unknown as AudioApiModule;
      ctx.audio.init(() => new mod.AudioContext());
      const audioCtx = ctx.audio.context;
      if (!audioCtx) return null;
      const channels = createChannels(audioCtx);
      const sfxChannel = channels.get('sfx');
      const musicChannel = channels.get('music');
      if (!sfxChannel || !musicChannel) return null;

      const pool = new SFXPool(16);
      pool.connect(audioCtx, sfxChannel.node);
      const sfxBuffers = loadSfxBuffers(audioCtx, AUDIO_MANIFEST);
      for (const [k, buf] of Object.entries(sfxBuffers)) {
        pool.register(k, buf);
      }

      const music = new Music();
      music.connect(audioCtx, musicChannel.node);
      const tracks = loadMusicBuffers(audioCtx, AUDIO_MANIFEST);
      for (const [k, buf] of Object.entries(tracks)) {
        music.register(k, buf);
      }

      cached = { pool, music, channels };
      return cached;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

/** Return the cached handles without initializing. */
export function getAudio(): AudioHandles | null {
  return cached;
}

/** Dispose the global audio graph. Stops all voices, halts music, drops the
 *  cache so a subsequent `initAudio` rebuilds a fresh context. */
export function disposeAudio(): void {
  if (!cached) return;
  try {
    cached.pool.stopAll();
  } catch {
    // teardown must never throw
  }
  try {
    cached.music.stop();
  } catch {
    // teardown must never throw
  }
  cached = null;
  resetSfxThrottle();
}

export { playSfx, setZoneMusic } from './sfx';
