import type { BeepKey } from '../audio';

/**
 * Per-SFX playback volume. Keeps magic numbers out of gameplay code;
 * change here to rebalance without touching scenes/systems.
 */
export const SFX_VOLUME: Record<BeepKey, number> = {
  shoot: 0.5,
  hit: 0.6,
  explode: 0.7,
  bomb: 0.9,
};

/** Concert-pitch reference note + frequency used by the MIDI helper. */
export const MIDI_REF_NOTE = 69; // A4
export const MIDI_REF_FREQ = 440; // Hz
