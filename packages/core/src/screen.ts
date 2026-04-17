import { Signal } from '@flare-engine/events';
import type { Rect, Vec2 } from '@flare-engine/math';

/** Scale mode for mapping design resolution to device screen. */
export type ScaleMode = 'fit' | 'fill' | 'stretch';

/** Screen configuration. */
export interface ScreenConfig {
  /** Design resolution width in logical pixels. */
  designWidth: number;
  /** Design resolution height in logical pixels. */
  designHeight: number;
  /** How to fit design resolution to device (default: 'fit'). */
  scaleMode?: ScaleMode;
}

/**
 * ScreenManager maps a fixed design resolution to the actual device screen.
 *
 * - FIT: letterbox (scale to fit, black bars)
 * - FILL: crop (scale to fill, content cropped)
 * - STRETCH: distort (stretch to fill, aspect ratio distorted)
 */
export class ScreenManager {
  /** Design resolution width. */
  readonly designWidth: number;
  /** Design resolution height. */
  readonly designHeight: number;
  /** Current scale mode. */
  scaleMode: ScaleMode;

  /** Device pixel ratio. */
  pixelRatio = 1;

  /** Safe area insets (top, right, bottom, left) in device pixels. */
  safeArea: Rect = { x: 0, y: 0, width: 0, height: 0 };

  /** Fires when screen dimensions change. */
  readonly onResize = new Signal<void>();

  /** Computed scale factor X (design → screen). */
  scaleX = 1;
  /** Computed scale factor Y (design → screen). */
  scaleY = 1;
  /** Offset X in screen pixels (for letterboxing). */
  offsetX = 0;
  /** Offset Y in screen pixels (for letterboxing). */
  offsetY = 0;

  private screenWidth = 0;
  private screenHeight = 0;

  constructor(config: ScreenConfig) {
    this.designWidth = config.designWidth;
    this.designHeight = config.designHeight;
    this.scaleMode = config.scaleMode ?? 'fit';
  }

  private safeInsetTop = 0;
  private safeInsetRight = 0;
  private safeInsetBottom = 0;
  private safeInsetLeft = 0;

  /** Update with actual device screen dimensions. Call on mount and resize. */
  resize(screenWidth: number, screenHeight: number, pixelRatio?: number): void {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    if (pixelRatio !== undefined) this.pixelRatio = pixelRatio;
    this.recalculate();
    this.recalculateSafeArea();
    this.onResize.emit();
  }

  /**
   * Set safe-area insets in screen pixels. Call this from the RN host with values from
   * `react-native-safe-area-context`. Populates `safeArea` as the usable region.
   */
  setSafeAreaInsets(top: number, right: number, bottom: number, left: number): void {
    this.safeInsetTop = top;
    this.safeInsetRight = right;
    this.safeInsetBottom = bottom;
    this.safeInsetLeft = left;
    this.recalculateSafeArea();
    this.onResize.emit();
  }

  private recalculateSafeArea(): void {
    this.safeArea.x = this.safeInsetLeft;
    this.safeArea.y = this.safeInsetTop;
    this.safeArea.width = Math.max(0, this.screenWidth - this.safeInsetLeft - this.safeInsetRight);
    this.safeArea.height = Math.max(
      0,
      this.screenHeight - this.safeInsetTop - this.safeInsetBottom,
    );
  }

  /** Convert design-space point to screen-space. */
  designToScreen(point: Vec2): Vec2 {
    return {
      x: point.x * this.scaleX + this.offsetX,
      y: point.y * this.scaleY + this.offsetY,
    };
  }

  /** Convert screen-space point to design-space. */
  screenToDesign(point: Vec2): Vec2 {
    return {
      x: (point.x - this.offsetX) / this.scaleX,
      y: (point.y - this.offsetY) / this.scaleY,
    };
  }

  /** Viewport rect in design coordinates (visible area). */
  get viewport(): Rect {
    if (this.scaleMode === 'fill') {
      // In fill mode, the visible area is smaller than design
      const visibleW = this.screenWidth / this.scaleX;
      const visibleH = this.screenHeight / this.scaleY;
      return {
        x: (this.designWidth - visibleW) / 2,
        y: (this.designHeight - visibleH) / 2,
        width: visibleW,
        height: visibleH,
      };
    }
    return { x: 0, y: 0, width: this.designWidth, height: this.designHeight };
  }

  private recalculate(): void {
    const ratioX = this.screenWidth / this.designWidth;
    const ratioY = this.screenHeight / this.designHeight;

    switch (this.scaleMode) {
      case 'fit': {
        const scale = Math.min(ratioX, ratioY);
        this.scaleX = scale;
        this.scaleY = scale;
        this.offsetX = (this.screenWidth - this.designWidth * scale) / 2;
        this.offsetY = (this.screenHeight - this.designHeight * scale) / 2;
        break;
      }
      case 'fill': {
        const scale = Math.max(ratioX, ratioY);
        this.scaleX = scale;
        this.scaleY = scale;
        this.offsetX = (this.screenWidth - this.designWidth * scale) / 2;
        this.offsetY = (this.screenHeight - this.designHeight * scale) / 2;
        break;
      }
      case 'stretch': {
        this.scaleX = ratioX;
        this.scaleY = ratioY;
        this.offsetX = 0;
        this.offsetY = 0;
        break;
      }
    }
  }
}
