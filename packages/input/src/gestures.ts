import { Signal } from '@flare/events';
import type { Vec2 } from '@flare/math';

/** Swipe direction. */
export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

/** Gesture detection configuration. */
export interface GestureConfig {
  /** Max time (seconds) for a tap (default 0.3). */
  tapMaxDuration?: number;
  /** Max distance (px) for a tap (default 20). */
  tapMaxDistance?: number;
  /** Min time (seconds) for a long press (default 0.5). */
  longPressMinDuration?: number;
  /** Min distance (px) for a swipe (default 50). */
  swipeMinDistance?: number;
  /** Max time (seconds) for a swipe (default 0.4). */
  swipeMaxDuration?: number;
}

/** Swipe event data. */
export interface SwipeEvent {
  direction: SwipeDirection;
  distance: number;
  duration: number;
}

/** Pinch event data. */
export interface PinchEvent {
  /** Scale factor (>1 = spread, <1 = pinch). */
  scale: number;
  /** Center point between the two touches. */
  center: Vec2;
}

const DEFAULT_TAP_MAX_DURATION = 0.3;
const DEFAULT_TAP_MAX_DISTANCE = 20;
const DEFAULT_LONG_PRESS_MIN_DURATION = 0.5;
const DEFAULT_SWIPE_MIN_DISTANCE = 50;
const DEFAULT_SWIPE_MAX_DURATION = 0.4;

/**
 * GestureDetector recognizes tap, long press, swipe, and pinch gestures
 * from raw pointer events.
 */
export class GestureDetector {
  readonly onTap = new Signal<Vec2>();
  readonly onLongPress = new Signal<Vec2>();
  readonly onSwipe = new Signal<SwipeEvent>();
  readonly onPinch = new Signal<PinchEvent>();

  private tapMaxDuration: number;
  private tapMaxDistance: number;
  private longPressMinDuration: number;
  private swipeMinDistance: number;
  private swipeMaxDuration: number;

  // Single-touch tracking
  private _startPos: Vec2 = { x: 0, y: 0 };
  private _startTime = 0;
  private _isTracking = false;
  private _longPressFired = false;

  // Pinch tracking
  private _pinchStartDistance = 0;
  private _pinchTouches: [Vec2, Vec2] | null = null;

  constructor(config?: GestureConfig) {
    this.tapMaxDuration = config?.tapMaxDuration ?? DEFAULT_TAP_MAX_DURATION;
    this.tapMaxDistance = config?.tapMaxDistance ?? DEFAULT_TAP_MAX_DISTANCE;
    this.longPressMinDuration = config?.longPressMinDuration ?? DEFAULT_LONG_PRESS_MIN_DURATION;
    this.swipeMinDistance = config?.swipeMinDistance ?? DEFAULT_SWIPE_MIN_DISTANCE;
    this.swipeMaxDuration = config?.swipeMaxDuration ?? DEFAULT_SWIPE_MAX_DURATION;
  }

  /** Feed a pointer-down event. */
  pointerDown(x: number, y: number): void {
    this._startPos = { x, y };
    this._startTime = 0;
    this._isTracking = true;
    this._longPressFired = false;
  }

  /** Feed a pointer-up event. */
  pointerUp(x: number, y: number, elapsedSinceDown: number): void {
    if (!this._isTracking) return;
    this._isTracking = false;

    const dx = x - this._startPos.x;
    const dy = y - this._startPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = elapsedSinceDown;

    // Check swipe first (requires min distance)
    if (dist >= this.swipeMinDistance && duration <= this.swipeMaxDuration) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      let direction: SwipeDirection;
      if (absDx > absDy) {
        direction = dx > 0 ? 'right' : 'left';
      } else {
        direction = dy > 0 ? 'down' : 'up';
      }
      this.onSwipe.emit({ direction, distance: dist, duration });
      return;
    }

    // Check tap (short press, small movement)
    if (dist <= this.tapMaxDistance && duration <= this.tapMaxDuration) {
      this.onTap.emit({ x, y });
      return;
    }
  }

  /**
   * Update gesture tracking. Call each frame with dt.
   * @param dt Delta time in seconds.
   * @param currentX Current pointer X.
   * @param currentY Current pointer Y.
   */
  update(dt: number, currentX: number, currentY: number): void {
    if (!this._isTracking) return;
    this._startTime += dt;

    // Long press detection
    if (!this._longPressFired && this._startTime >= this.longPressMinDuration) {
      const dx = currentX - this._startPos.x;
      const dy = currentY - this._startPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.tapMaxDistance) {
        this._longPressFired = true;
        this.onLongPress.emit({ x: currentX, y: currentY });
      }
    }
  }

  /**
   * Feed a two-finger pinch update. Call when two touches are active.
   * @param t1 First touch position.
   * @param t2 Second touch position.
   */
  pinchUpdate(t1: Vec2, t2: Vec2): void {
    const dx = t2.x - t1.x;
    const dy = t2.y - t1.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (this._pinchTouches === null) {
      // Start pinch
      this._pinchStartDistance = dist;
      this._pinchTouches = [{ ...t1 }, { ...t2 }];
      return;
    }

    if (this._pinchStartDistance > 0) {
      const scale = dist / this._pinchStartDistance;
      const center: Vec2 = {
        x: (t1.x + t2.x) / 2,
        y: (t1.y + t2.y) / 2,
      };
      this.onPinch.emit({ scale, center });
    }
  }

  /** Call when pinch ends (fewer than 2 touches). */
  pinchEnd(): void {
    this._pinchTouches = null;
    this._pinchStartDistance = 0;
  }
}
