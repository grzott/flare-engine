import type { Music as MusicT } from '@flare-engine/audio';
import type { AudioHandles } from './init';
import type { MusicKey, SfxKey } from './synth';

/** Minimum gap between successive plays of the same SFX key (ms). Prevents
 *  the 16-voice pool saturating during bullet-dense waves, which manifests
 *  as "all sounds overlap" on device after long sessions. */
const SFX_MIN_GAP_MS = 30;
const lastPlayedAt = new Map<SfxKey, number>();

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Clear throttle bookkeeping — called on audio disposal. */
export function resetSfxThrottle(): void {
  lastPlayedAt.clear();
}

/** Throttled SFX play. Safe to call from collision signals every frame. */
export function playSfx(handles: AudioHandles | null | undefined, key: SfxKey): void {
  if (!handles) return;
  const now = nowMs();
  const last = lastPlayedAt.get(key) ?? 0;
  if (now - last < SFX_MIN_GAP_MS) return;
  lastPlayedAt.set(key, now);
  handles.pool.play(key);
}

/** Crossfade music for the given zone, or do nothing if audio isn't ready.
 *  Skips no-op requests (same track already playing) to avoid layering
 *  overlapping crossfades. */
export function setZoneMusic(music: MusicT | null, key: MusicKey): void {
  if (!music) return;
  if (music.playing === key) return;
  if (music.playing === null) music.play(key, true);
  else music.crossfadeTo(key, 0.6, true);
}
