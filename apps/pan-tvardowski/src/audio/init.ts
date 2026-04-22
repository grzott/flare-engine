import type {
  AudioContextLike,
  GameContextValue,
  Music as MusicT,
  SFXPool as SFXPoolT,
} from '@flare-engine/engine';
import { Music, SFXPool, createChannels } from '@flare-engine/engine';
import { type MusicKey, type SfxKey, createMusicBuffers, createSfxBuffers } from './synth';

interface AudioApiModule {
  AudioContext: new () => AudioContextLike;
}

export interface AudioHandles {
  pool: SFXPoolT;
  music: MusicT;
  channels: ReturnType<typeof createChannels>;
}

/**
 * Initialize the audio subsystem: dynamically imports `react-native-audio-api`,
 * builds channels, registers procedurally synthesized SFX + music buffers.
 * Returns `null` if the native module is unavailable (e.g. test or web-only).
 */
export async function initAudio(ctx: GameContextValue): Promise<AudioHandles | null> {
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
    const sfxBuffers = createSfxBuffers(audioCtx);
    for (const [k, buf] of Object.entries(sfxBuffers) as [SfxKey, (typeof sfxBuffers)[SfxKey]][]) {
      pool.register(k, buf);
    }

    const music = new Music();
    music.connect(audioCtx, musicChannel.node);
    const tracks = createMusicBuffers(audioCtx);
    for (const [k, buf] of Object.entries(tracks) as [MusicKey, (typeof tracks)[MusicKey]][]) {
      music.register(k, buf);
    }

    return { pool, music, channels };
  } catch {
    return null;
  }
}

/** Crossfade music for the given zone, or do nothing if audio isn't ready. */
export function setZoneMusic(music: MusicT | null, key: MusicKey): void {
  if (!music) return;
  if (music.playing === key) return;
  if (music.playing === null) music.play(key, true);
  else music.crossfadeTo(key, 0.6, true);
}
