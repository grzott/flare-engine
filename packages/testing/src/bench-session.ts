import { SeededRNG } from '@flare-engine/math';
import type { SeededRNG as SeededRNGType } from '@flare-engine/math';

export interface BenchSessionOptions {
  seed?: number;
}

export interface BenchSession {
  readonly rng: SeededRNGType;
  setFlag(name: string, value: boolean): void;
  getFlag(name: string): boolean;
  /** Resolves whenDone. Idempotent — safe to call multiple times. */
  done(): void;
  readonly whenDone: Promise<void>;
  /** Restores Math.random. Idempotent. */
  end(): void;
}

/**
 * Creates a deterministic bench session. Installs a SeededRNG-backed Math.random.
 *
 * Sessions must be ended LIFO if nested. Callers should wrap usage in try/finally
 * so a throw between install and end() cannot leak the patched Math.random.
 */
export function createBenchSession(opts: BenchSessionOptions = {}): BenchSession {
  const seed = opts.seed ?? 1;
  const rng = new SeededRNG(seed);

  const originalRandom = Math.random;
  const patched = () => rng.next();
  Math.random = patched;

  const flags: Record<string, boolean> = {};

  let resolve: (() => void) | null = null;
  const whenDone = new Promise<void>((res) => {
    resolve = res;
  });

  let doneResolved = false;

  return {
    rng,
    setFlag(name: string, value: boolean): void {
      flags[name] = value;
    },
    getFlag(name: string): boolean {
      return flags[name] ?? false;
    },
    done(): void {
      if (!doneResolved) {
        doneResolved = true;
        resolve?.();
      }
    },
    whenDone,
    end(): void {
      // Only restore when our own patch is still active — guards against
      // out-of-order end() clobbering a newer session's patch.
      if (Math.random === patched) {
        Math.random = originalRandom;
      }
    },
  };
}
