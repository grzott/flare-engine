import { describe, expect, it } from 'bun:test';
import { InputManager } from '../src/input-manager.js';

describe('InputManager', () => {
  it('initializes with default pointer state', () => {
    const input = new InputManager();
    expect(input.pointer.isDown).toBe(false);
    expect(input.pointer.position).toEqual({ x: 0, y: 0 });
    expect(input.touches).toEqual([]);
  });

  it('onPointerDown updates pointer and adds touch', () => {
    const input = new InputManager();
    input.onPointerDown(1, 100, 200);
    expect(input.pointer.isDown).toBe(true);
    expect(input.pointer.justPressed).toBe(true);
    expect(input.pointer.position).toEqual({ x: 100, y: 200 });
    expect(input.touches).toHaveLength(1);
    expect(input.touches[0]).toEqual({
      id: 1,
      position: { x: 100, y: 200 },
      isDown: true,
    });
  });

  it('onPointerMove updates pointer and touch position', () => {
    const input = new InputManager();
    input.onPointerDown(1, 100, 200);
    input.onPointerMove(1, 150, 250);
    expect(input.pointer.position).toEqual({ x: 150, y: 250 });
    expect(input.touches[0]?.position).toEqual({ x: 150, y: 250 });
  });

  it('onPointerUp clears pointer and removes touch', () => {
    const input = new InputManager();
    input.onPointerDown(1, 100, 200);
    input.onPointerUp(1, 100, 200);
    expect(input.pointer.isDown).toBe(false);
    expect(input.pointer.justReleased).toBe(true);
    expect(input.touches).toHaveLength(0);
  });

  it('update resets per-frame flags', () => {
    const input = new InputManager();
    input.onPointerDown(1, 10, 20);
    expect(input.pointer.justPressed).toBe(true);

    input.update();
    expect(input.pointer.justPressed).toBe(false);
    expect(input.pointer.delta).toEqual({ x: 0, y: 0 });
    // isDown persists
    expect(input.pointer.isDown).toBe(true);
  });

  it('tracks multiple touches', () => {
    const input = new InputManager();
    input.onPointerDown(1, 10, 20);
    input.onPointerDown(2, 30, 40);
    expect(input.touches).toHaveLength(2);

    input.onPointerUp(1, 10, 20);
    expect(input.touches).toHaveLength(1);
    expect(input.touches[0]?.id).toBe(2);
  });

  it('removing non-existent touch is no-op', () => {
    const input = new InputManager();
    input.onPointerUp(999, 0, 0); // Should not throw
    expect(input.touches).toHaveLength(0);
  });

  // F038 — pointer.pointer must track only the primary (first) touch. A
  // second finger (e.g. a HUD button held under the other thumb) must not
  // move, release, or re-press the primary pointer.
  describe('pointer tracks only the primary touch (F038)', () => {
    it('a second finger down does not move or re-press the primary pointer', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20); // primary
      input.update();
      input.onPointerDown(2, 500, 500); // secondary — must not affect pointer
      expect(input.pointer.position).toEqual({ x: 10, y: 20 });
      expect(input.pointer.delta).toEqual({ x: 0, y: 0 });
      expect(input.pointer.justPressed).toBe(false);
      expect(input.touches).toHaveLength(2);
    });

    it('lifting the second finger leaves the primary pointer down with no release', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20); // primary
      input.onPointerDown(2, 500, 500); // secondary
      input.onPointerUp(2, 500, 500); // secondary lifts

      expect(input.pointer.isDown).toBe(true);
      expect(input.pointer.justReleased).toBe(false);
      expect(input.touches).toHaveLength(1);
      expect(input.touches[0]?.id).toBe(1);
    });

    it('a second finger moving does not move the primary pointer', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20); // primary
      input.onPointerDown(2, 500, 500); // secondary
      input.update();
      input.onPointerMove(2, 600, 600); // secondary moves

      expect(input.pointer.position).toEqual({ x: 10, y: 20 });
      expect(input.pointer.delta).toEqual({ x: 0, y: 0 });
      expect(input.touches.find((t) => t.id === 2)?.position).toEqual({ x: 600, y: 600 });
    });

    it('lifting the primary finger releases pointer even while a second finger is down, and does not transfer', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20); // primary
      input.onPointerDown(2, 500, 500); // secondary
      input.onPointerUp(1, 10, 20); // primary lifts

      expect(input.pointer.isDown).toBe(false);
      expect(input.pointer.justReleased).toBe(true);

      // The remaining finger does NOT become the new primary — its moves
      // are visible only via `touches`, not `pointer`.
      input.update();
      input.onPointerMove(2, 700, 700);
      expect(input.pointer.isDown).toBe(false);
      expect(input.pointer.position).toEqual({ x: 10, y: 20 });
    });

    it('a fresh touch while a stale finger is still down does not become primary', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20); // primary
      input.onPointerDown(2, 500, 500); // secondary
      input.onPointerUp(1, 10, 20); // primary lifts; 2 still down
      input.update(); // clear the stale justPressed/justReleased edges from above

      input.onPointerDown(3, 900, 900); // third finger — touchMap not empty
      expect(input.pointer.isDown).toBe(false);
      expect(input.pointer.justPressed).toBe(false);
      expect(input.touches).toHaveLength(2);
    });

    it('a new primary is assigned once every touch has lifted', () => {
      const input = new InputManager();
      input.onPointerDown(1, 10, 20);
      input.onPointerDown(2, 500, 500);
      input.onPointerUp(1, 10, 20);
      input.onPointerUp(2, 500, 500); // all fingers up

      input.onPointerDown(3, 900, 900); // fresh gesture
      expect(input.pointer.isDown).toBe(true);
      expect(input.pointer.justPressed).toBe(true);
      expect(input.pointer.position).toEqual({ x: 900, y: 900 });
    });
  });

  it('update resets keyboard per-frame flags', () => {
    const input = new InputManager();
    input.keyboard.keyDown('Enter');
    expect(input.keyboard.wasPressed('Enter')).toBe(true);

    input.update();
    expect(input.keyboard.wasPressed('Enter')).toBe(false);
    // isDown persists across the frame boundary
    expect(input.keyboard.isDown('Enter')).toBe(true);
  });
});
