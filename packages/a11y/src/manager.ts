import { Signal } from '@flare-engine/events';

export type ContrastLevel = 'normal' | 'high';

export interface A11ySettings {
  /** When true, animations and heavy postfx should be minimized. */
  reducedMotion: boolean;
  /** Current contrast preference — UI tokens swap accordingly. */
  contrast: ContrastLevel;
  /** Global UI scale multiplier (`1` = default). */
  uiScale: number;
}

export interface A11yManagerOptions {
  initial?: Partial<A11ySettings>;
}

const DEFAULTS: A11ySettings = {
  reducedMotion: false,
  contrast: 'normal',
  uiScale: 1,
};

/**
 * Central accessibility state. Systems subscribe via `onChange` and read the
 * current snapshot via `settings`. The manager owns no platform wiring — a
 * host app may bridge OS preferences (e.g., `AccessibilityInfo.isReduceMotionEnabled`)
 * by pushing values in on startup.
 */
export class A11yManager {
  readonly onChange = new Signal<A11ySettings>();
  private _settings: A11ySettings;

  constructor(options: A11yManagerOptions = {}) {
    this._settings = { ...DEFAULTS, ...options.initial };
  }

  get settings(): A11ySettings {
    return this._settings;
  }

  get reducedMotion(): boolean {
    return this._settings.reducedMotion;
  }

  get contrast(): ContrastLevel {
    return this._settings.contrast;
  }

  get uiScale(): number {
    return this._settings.uiScale;
  }

  update(patch: Partial<A11ySettings>): void {
    const next: A11ySettings = { ...this._settings, ...patch };
    if (
      next.reducedMotion === this._settings.reducedMotion &&
      next.contrast === this._settings.contrast &&
      next.uiScale === this._settings.uiScale
    ) {
      return;
    }
    this._settings = next;
    this.onChange.emit(next);
  }

  setReducedMotion(v: boolean): void {
    this.update({ reducedMotion: v });
  }

  setContrast(v: ContrastLevel): void {
    this.update({ contrast: v });
  }

  setUiScale(v: number): void {
    this.update({ uiScale: v });
  }
}
