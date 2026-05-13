/** PT-local point light descriptor. */
export interface PointLight {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  intensity: number;
  radius: number;
}

/**
 * Live state for the rim-light pass.
 * Pre-allocated at boot — zero-alloc after init.
 */
export interface RimLightState {
  /** Pre-allocated 12-float uniform buffer — mutated in place each frame. */
  uniforms: Float32Array;
  /** True while the boss is alive in phase1 or phase2. */
  enabled: boolean;
  /** Boss position in screen-space (updated by smok.ts orbit callback). */
  bossX: number;
  bossY: number;
  /** Logical radius of the boss disc (screen pixels). */
  bossRadius: number;
}
