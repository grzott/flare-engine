import type { FlarePreset } from './presets';

/** A preset, or the name one was registered under. */
export type PresetRef = FlarePreset | string;

export interface PresetRegistry {
  /** Store `p` under `name`, replacing any preset already there. */
  register(name: string, p: FlarePreset): void;
  /** A preset resolves to itself, a name to its preset. Throws a `RangeError` for an unknown name. */
  resolve(ref: PresetRef): FlarePreset;
}

/** A name → preset table. Registries are independent of each other. */
export function createPresetRegistry(): PresetRegistry {
  const presets = new Map<string, FlarePreset>();
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
