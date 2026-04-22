import type { Effect, EffectUniforms } from './effect.js';

/**
 * Ordered post-processing pipeline. Pure data structure — the runtime reads
 * the enabled entries in order and feeds each through its compiled shader.
 */
export class EffectChain {
  private _effects: Effect[] = [];
  private _globalIntensity = 1;

  get length(): number {
    return this._effects.length;
  }

  /**
   * Global intensity multiplier applied to every enabled effect's
   * "strength" uniform when the pass is built. Default 1 (no-op).
   *
   * Scales the following uniform fields at pass-build time:
   *  - vignette.intensity
   *  - grayscale-flash.intensity
   *  - chromatic-aberration.amount
   *  - crt.scanlineIntensity
   *  - bloom.intensity
   *
   * Geometry-like uniforms (radius, curvature, threshold) are not scaled.
   * Intended for a11y reduced-motion (set to 0 to null all dampen-able
   * effects in one call) without touching per-effect state.
   *
   * Clamped to `>= 0`. Negative values are clamped to 0.
   */
  get globalIntensity(): number {
    return this._globalIntensity;
  }

  set globalIntensity(value: number) {
    this._globalIntensity = value < 0 ? 0 : value;
  }

  /** Convenience setter — mirrors the getter/setter. */
  setGlobalIntensity(value: number): void {
    this.globalIntensity = value;
  }

  /** Snapshot view of the chain. Do not mutate. */
  all(): readonly Effect[] {
    return this._effects;
  }

  /** Append an effect to the end of the chain. */
  add(effect: Effect): void {
    if (this._effects.some((e) => e.id === effect.id)) {
      throw new Error(`EffectChain: duplicate id "${effect.id}"`);
    }
    this._effects.push(effect);
  }

  /** Insert an effect at a specific index (clamped to [0, length]). */
  insert(index: number, effect: Effect): void {
    if (this._effects.some((e) => e.id === effect.id)) {
      throw new Error(`EffectChain: duplicate id "${effect.id}"`);
    }
    const i = Math.max(0, Math.min(this._effects.length, index));
    this._effects.splice(i, 0, effect);
  }

  remove(id: string): boolean {
    const i = this._effects.findIndex((e) => e.id === id);
    if (i === -1) return false;
    this._effects.splice(i, 1);
    return true;
  }

  get(id: string): Effect | null {
    return this._effects.find((e) => e.id === id) ?? null;
  }

  setEnabled(id: string, enabled: boolean): void {
    const e = this.get(id);
    if (e) e.enabled = enabled;
  }

  /** Update uniforms in place. Kind must match the existing effect's kind. */
  setUniforms(id: string, uniforms: EffectUniforms): void {
    const e = this.get(id);
    if (!e) return;
    if (e.uniforms.kind !== uniforms.kind) {
      throw new Error(
        `EffectChain: cannot change kind of "${id}" from "${e.uniforms.kind}" to "${uniforms.kind}"`,
      );
    }
    e.uniforms = uniforms;
  }

  move(id: string, newIndex: number): void {
    const i = this._effects.findIndex((e) => e.id === id);
    if (i === -1) return;
    const [removed] = this._effects.splice(i, 1);
    if (!removed) return;
    const clamped = Math.max(0, Math.min(this._effects.length, newIndex));
    this._effects.splice(clamped, 0, removed);
  }

  clear(): void {
    this._effects.length = 0;
  }

  /** Iterate only over enabled effects, in order. */
  *enabled(): IterableIterator<Effect> {
    for (const e of this._effects) {
      if (e.enabled) yield e;
    }
  }
}
