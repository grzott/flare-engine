import type { GamepadSource } from './gamepad-source.js';
import {
  type GamepadState,
  createGamepadState,
  resetGamepadFrame,
  updateGamepadFromSnapshot,
} from './gamepad.js';
import {
  type Pointer,
  type TouchPoint,
  createPointer,
  pointerDown,
  pointerMove,
  pointerUp,
  resetPointerFrame,
} from './pointer.js';
import type { RemapTable } from './remap.js';
import { applyRemap } from './remap.js';

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
  private _gamepads: GamepadState[] = [];
  private _gamepadDeadZone = 0.15;
  private _gamepadRemaps = new Map<number, RemapTable>();

  /** Call once per frame to reset per-frame flags. */
  update(): void {
    resetPointerFrame(this.pointer);
    for (let i = 0; i < this._gamepads.length; i++) {
      const pad = this._gamepads[i];
      if (pad) resetGamepadFrame(pad);
    }
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

  /** Access the gamepad state at `index`. Allocates on first access. */
  gamepad(index: number): GamepadState {
    let pad = this._gamepads[index];
    if (!pad) {
      pad = createGamepadState(index);
      this._gamepads[index] = pad;
    }
    return pad;
  }

  /** Dead zone in [0, 1). Axes at or below this magnitude read as 0. */
  setGamepadDeadZone(deadZone: number): void {
    this._gamepadDeadZone = Math.max(0, Math.min(0.95, deadZone));
  }

  /** Install a remap table for a specific gamepad index. Pass `null` to clear. */
  setGamepadRemap(index: number, table: RemapTable | null): void {
    if (table === null) this._gamepadRemaps.delete(index);
    else this._gamepadRemaps.set(index, table);
  }

  /** Poll all gamepads from the given source, applying remap + dead zones. */
  pollGamepads(source: GamepadSource): void {
    const snapshots = source.poll();
    for (let i = 0; i < snapshots.length; i++) {
      const pad = this.gamepad(i);
      const snap = snapshots[i] ?? null;
      const remapped =
        snap !== null
          ? this._gamepadRemaps.get(i)
            ? applyRemap(snap, this._gamepadRemaps.get(i) as RemapTable)
            : snap
          : null;
      updateGamepadFromSnapshot(pad, remapped, this._gamepadDeadZone);
    }
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
