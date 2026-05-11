import { gameState, notifyStateChanged } from '../state';

export function getReducedMotion(): boolean {
  return gameState.settings.reducedMotion;
}

export function applyShake(
  camera: { shake(amp: number, dur: number): void },
  amp: number,
  dur: number,
): void {
  if (gameState.settings.reducedMotion || !gameState.settings.screenShake) {
    gameState.redFlash = true;
    notifyStateChanged();
    return;
  }
  camera.shake(amp, dur);
}

export function applyShakePerlin(
  camera: { shakePerlin(amp: number, dur: number): void },
  amp: number,
  dur: number,
): void {
  if (gameState.settings.reducedMotion || !gameState.settings.screenShake) {
    gameState.redFlash = true;
    notifyStateChanged();
    return;
  }
  camera.shakePerlin(amp, dur);
}

/**
 * Returns 1.0 normally; 0.7 under reducedMotion (dim 70% per folio XIV §11
 * reduce-motion rule 2 — "sigil pulse → dim 70%, no animation").
 */
export function sigilOpacity(reducedMotion: boolean): number {
  return reducedMotion ? 0.7 : 1.0;
}

/**
 * Returns the supplied base velocity under normal motion; 0 under
 * reducedMotion (spawn-static — particle exists but does not drift).
 */
export function getParallaxVelocity(base: number, reducedMotion: boolean): number {
  return reducedMotion ? 0 : base;
}
