import type { AudioContextLike } from '@flare-engine/engine';
import type { AudioBufferLike } from '@flare-engine/engine';
import { createMusicBuffers, createSfxBuffers } from '../audio/synth';
import type { AudioManifest } from './manifest-types';

/**
 * Load SFX buffers for all `sfx` entries listed in `manifest`.
 *
 * Dispatch on `entry.kind`:
 *   - `'synth'` → calls `createSfxBuffers` and returns only the keys listed in
 *     the manifest.
 *   - `'file'` → reserved for M9.6 production drop (throws).
 */
export function loadSfxBuffers(
  ctx: AudioContextLike,
  manifest: AudioManifest,
): Record<string, AudioBufferLike> {
  const all = createSfxBuffers(ctx);
  const result: Record<string, AudioBufferLike> = {};
  for (const entry of manifest.sfx) {
    if (entry.kind === 'synth') {
      const buf = (all as Record<string, AudioBufferLike | undefined>)[entry.key];
      if (buf !== undefined) result[entry.key] = buf;
    } else if (entry.kind === 'file') {
      throw new Error('file kind reserved for M9.6 production drop');
    } else {
      throw new Error(`loadSfxBuffers: unknown kind "${(entry as { kind: string }).kind}"`);
    }
  }
  return result;
}

/**
 * Load music buffers for all `music` entries listed in `manifest`.
 *
 * Dispatch on `entry.kind`:
 *   - `'synth'` → calls `createMusicBuffers` and returns only the keys listed.
 *   - `'file'` → reserved for M9.6 production drop (throws).
 */
export function loadMusicBuffers(
  ctx: AudioContextLike,
  manifest: AudioManifest,
): Record<string, AudioBufferLike> {
  const all = createMusicBuffers(ctx);
  const result: Record<string, AudioBufferLike> = {};
  for (const entry of manifest.music) {
    if (entry.kind === 'synth') {
      const buf = (all as Record<string, AudioBufferLike | undefined>)[entry.key];
      if (buf !== undefined) result[entry.key] = buf;
    } else if (entry.kind === 'file') {
      throw new Error('file kind reserved for M9.6 production drop');
    } else {
      throw new Error(`loadMusicBuffers: unknown kind "${(entry as { kind: string }).kind}"`);
    }
  }
  return result;
}
