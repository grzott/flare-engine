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
});
