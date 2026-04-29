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
