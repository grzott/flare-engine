import { describe, expect, test } from 'bun:test';
import { createMockInputManager } from '../src/mock-input.js';

describe('MockInputManager', () => {
  test('press updates pointer and touches', () => {
    const m = createMockInputManager();
    m.press(10, 20);
    expect(m.pointer.isDown).toBe(true);
    expect(m.pointer.position).toEqual({ x: 10, y: 20 });
    expect(m.touches.length).toBe(1);
  });

  test('move updates pointer position', () => {
    const m = createMockInputManager();
    m.press(0, 0);
    m.move(50, 60);
    expect(m.pointer.position).toEqual({ x: 50, y: 60 });
  });

  test('release clears the touch', () => {
    const m = createMockInputManager();
    m.press(0, 0);
    m.release(0, 0);
    expect(m.pointer.isDown).toBe(false);
    expect(m.touches.length).toBe(0);
  });

  test('tap is press + release in one call', () => {
    const m = createMockInputManager();
    m.tap(5, 5);
    expect(m.pointer.isDown).toBe(false);
    expect(m.touches.length).toBe(0);
  });

  test('multi-touch via explicit ids', () => {
    const m = createMockInputManager();
    m.press(0, 0, 0);
    m.press(10, 10, 1);
    expect(m.touches.length).toBe(2);
    m.release(10, 10, 1);
    expect(m.touches.length).toBe(1);
    expect(m.touches[0]?.id).toBe(0);
  });
});
