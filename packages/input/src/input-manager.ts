import {
  type Pointer,
  type TouchPoint,
  createPointer,
  pointerDown,
  pointerMove,
  pointerUp,
  resetPointerFrame,
} from './pointer.js';

/**
 * InputManager provides a polling-based input model.
 *
 * Call `update()` once per frame (before game logic) to snapshot input state.
 * Feed events from the platform (RN touch/gesture handlers) via the on* methods.
 */
export class InputManager {
  /** Primary pointer (first touch or mouse). */
  readonly pointer: Pointer = createPointer();

  /** All active touch points. */
  readonly touches: TouchPoint[] = [];

  private _touchMap = new Map<number, TouchPoint>();

  /** Call once per frame to reset per-frame flags. */
  update(): void {
    resetPointerFrame(this.pointer);
  }

  /** Feed a touch/pointer begin event. */
  onPointerDown(id: number, x: number, y: number): void {
    pointerDown(this.pointer, x, y);
    this._addOrUpdateTouch(id, x, y, true);
  }

  /** Feed a touch/pointer move event. */
  onPointerMove(id: number, x: number, y: number): void {
    pointerMove(this.pointer, x, y);
    this._addOrUpdateTouch(id, x, y, true);
  }

  /** Feed a touch/pointer end event. */
  onPointerUp(id: number, x: number, y: number): void {
    pointerUp(this.pointer, x, y);
    this._removeTouch(id);
  }

  private _addOrUpdateTouch(id: number, x: number, y: number, isDown: boolean): void {
    let touch = this._touchMap.get(id);
    if (!touch) {
      touch = { id, position: { x, y }, isDown };
      this._touchMap.set(id, touch);
      this.touches.push(touch);
    } else {
      touch.position.x = x;
      touch.position.y = y;
      touch.isDown = isDown;
    }
  }

  private _removeTouch(id: number): void {
    const touch = this._touchMap.get(id);
    if (!touch) return;
    this._touchMap.delete(id);
    const idx = this.touches.indexOf(touch);
    if (idx !== -1) {
      this.touches.splice(idx, 1);
    }
  }
}
