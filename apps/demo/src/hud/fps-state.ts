import { Signal } from '@flare-engine/engine';

export const fpsState = { line: '' };
export const fpsChanged = new Signal<void>();

export const showFpsState = { show: true };
export const showFpsChanged = new Signal<void>();

export function publishFps(line: string): void {
  if (fpsState.line === line) return;
  fpsState.line = line;
  fpsChanged.emit();
}

export function toggleShowFps(): void {
  showFpsState.show = !showFpsState.show;
  showFpsChanged.emit();
}
