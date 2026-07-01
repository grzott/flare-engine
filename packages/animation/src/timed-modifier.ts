export interface TimedModifier<T> {
  readonly value: T;
  readonly combine: (base: T, modifier: T) => T;
  remaining: number;
}

export function createTimedModifier<T>(
  value: T,
  duration: number,
  combine: (base: T, modifier: T) => T,
): TimedModifier<T> {
  if (duration <= 0) throw new Error('createTimedModifier: duration must be > 0');
  return { value, combine, remaining: duration };
}

export function tickModifier<T>(mod: TimedModifier<T>, dt: number): void {
  mod.remaining = mod.remaining - dt < 0 ? 0 : mod.remaining - dt;
}

export function isModifierActive<T>(mod: TimedModifier<T>): boolean {
  return mod.remaining > 0;
}

/**
 * Returns combine(base, mod.value) when active, base otherwise.
 * Zero-alloc only when T is number and combine is pure arithmetic.
 */
export function applyModifier<T>(base: T, mod: TimedModifier<T>): T {
  return mod.remaining > 0 ? mod.combine(base, mod.value) : base;
}
