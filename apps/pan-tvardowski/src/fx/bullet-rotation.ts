/**
 * Compute sprite rotation for a bullet travelling at (vx, vy).
 *
 * Convention: the laser sprites (laserBlue01, laserRed01, piorun-bullet)
 * are drawn pointing UPWARD in image-space (portrait, tip at top, Y-down).
 * atan2(vy, vx) gives the heading angle where right=0, down=π/2.
 * Adding π/2 rotates the up-pointing sprite to match that heading.
 *
 * Regression:
 *   Player fires upward (vx=0, vy<0): atan2(-v,0)=−π/2 → −π/2+π/2 = 0 (no-op).
 *   Dot/circular sprites are rotation-invariant; applying rotation is harmless.
 *
 * Edge: zero velocity (vx=0, vy=0) → atan2(0,0)=0 → returns π/2 (pointing right),
 * visually acceptable since the bullet has no travel direction anyway.
 */
export function bulletSpriteRotation(vx: number, vy: number): number {
  return Math.atan2(vy, vx) + Math.PI / 2;
}
