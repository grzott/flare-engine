/**
 * KG4: smooth sine-wave alpha pulse for bullet sprites.
 *
 * Pure function — no imports, no side-effects. Exported so the play scene
 * loop and unit tests both consume the same formula.
 *
 * Period: 2 seconds.
 * Player range: [0.55, 1.0]  (laserBlue01)
 * Enemy range:  [0.45, 0.90] (laserRed01)
 *
 * Reduced motion: returns 1.0 (full opacity, no animation).
 * Alpha-only: collider size is derived from frame.w/h * scale, unaffected.
 */
export function bulletPulseAlpha(accum: number, isPlayer: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return 1.0;
  const period = 2.0;
  const t = (accum % period) / period;
  const sine = Math.sin(2 * Math.PI * t);
  const unit = 0.5 * (1 + sine);
  if (isPlayer) {
    return 0.55 + 0.45 * unit;
  }
  return 0.45 + 0.45 * unit;
}
