import type { FlarePreset } from './presets';
import type { FlareTimeline } from './timeline';

/** A preset or timeline, or the name one was registered under. */
export type PresetRef = FlarePreset | FlareTimeline | string;

export interface PresetRegistry {
  /** Store `p` under `name`, replacing anything already there. */
  register(name: string, p: FlarePreset | FlareTimeline): void;
  /**
   * A preset or timeline resolves to itself, a name to what was registered under it. Throws a
   * `RangeError` for an unknown name.
   */
  resolve(ref: PresetRef): FlarePreset | FlareTimeline;
}

/** A name → preset or timeline table. Registries are independent of each other. */
export function createPresetRegistry(): PresetRegistry {
  const presets = new Map<string, FlarePreset | FlareTimeline>();
  return {
    register(name, p) {
      presets.set(name, p);
    },
    resolve(ref) {
      if (typeof ref !== 'string') return ref;
      const preset = presets.get(ref);
      if (preset === undefined) throw new RangeError(`ui-fx: unknown preset "${ref}"`);
      return preset;
    },
  };
}
