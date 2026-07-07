import type { Vec2 } from '@flare-engine/math';

/** State of a single pointer (primary touch or mouse). */
export interface Pointer {
  /** Current position in screen coordinates. */
  position: Vec2;
  /** Position delta since last frame. */
  delta: Vec2;
  /** Whether the pointer is currently held down. */
  isDown: boolean;
  /** True only on the frame the pointer was pressed. */
  justPressed: boolean;
  /** True only on the frame the pointer was released. */
  justReleased: boolean;
}

/** State of a single touch point in a multitouch scenario. */
export interface TouchPoint {
  /** Unique touch identifier. */
  id: number;
  /** Current position in screen coordinates. */
  position: Vec2;
  /** Whether this touch is currently active. */
  isDown: boolean;
}

/** Create a default pointer state. */
export function createPointer(): Pointer {
  return {
    position: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
    isDown: false,
    justPressed: false,
    justReleased: false,
  };
}

/**
 * Update pointer state for a new frame.
 * Call this at the start of each frame to clear per-frame flags.
 */
export function resetPointerFrame(pointer: Pointer): void {
  pointer.delta.x = 0;
  pointer.delta.y = 0;
  pointer.justPressed = false;
  pointer.justReleased = false;
}

/** Feed a pointer-down event into the pointer state. */
export function pointerDown(pointer: Pointer, x: number, y: number): void {
  const wasDown = pointer.isDown;
  pointer.isDown = true;
  if (!wasDown) {
    pointer.justPressed = true;
  }
  pointer.delta.x += x - pointer.position.x;
  pointer.delta.y += y - pointer.position.y;
  pointer.position.x = x;
  pointer.position.y = y;
}

/** Feed a pointer-move event into the pointer state. */
export function pointerMove(pointer: Pointer, x: number, y: number): void {
  pointer.delta.x += x - pointer.position.x;
  pointer.delta.y += y - pointer.position.y;
  pointer.position.x = x;
  pointer.position.y = y;
}

/** Feed a pointer-up event into the pointer state. */
export function pointerUp(pointer: Pointer, x: number, y: number): void {
  pointer.isDown = false;
  pointer.justReleased = true;
  pointer.delta.x += x - pointer.position.x;
  pointer.delta.y += y - pointer.position.y;
  pointer.position.x = x;
  pointer.position.y = y;
}
