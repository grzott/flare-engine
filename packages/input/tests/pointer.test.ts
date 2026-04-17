import { describe, expect, it } from 'bun:test';
import {
  createPointer,
  pointerDown,
  pointerMove,
  pointerUp,
  resetPointerFrame,
} from '../src/pointer.js';

describe('Pointer', () => {
  it('creates with default state', () => {
    const p = createPointer();
    expect(p.position).toEqual({ x: 0, y: 0 });
    expect(p.delta).toEqual({ x: 0, y: 0 });
    expect(p.isDown).toBe(false);
    expect(p.justPressed).toBe(false);
    expect(p.justReleased).toBe(false);
  });

  it('pointerDown sets isDown and justPressed', () => {
    const p = createPointer();
    pointerDown(p, 10, 20);
    expect(p.isDown).toBe(true);
    expect(p.justPressed).toBe(true);
    expect(p.position).toEqual({ x: 10, y: 20 });
    expect(p.delta).toEqual({ x: 10, y: 20 });
  });

  it('pointerDown while already down does not set justPressed', () => {
    const p = createPointer();
    pointerDown(p, 10, 20);
    resetPointerFrame(p);
    pointerDown(p, 15, 25);
    expect(p.isDown).toBe(true);
    expect(p.justPressed).toBe(false);
  });

  it('pointerMove updates position and delta', () => {
    const p = createPointer();
    pointerDown(p, 10, 20);
    resetPointerFrame(p);
    pointerMove(p, 30, 40);
    expect(p.position).toEqual({ x: 30, y: 40 });
    expect(p.delta).toEqual({ x: 20, y: 20 });
  });

  it('pointerUp sets justReleased and clears isDown', () => {
    const p = createPointer();
    pointerDown(p, 10, 20);
    resetPointerFrame(p);
    pointerUp(p, 10, 20);
    expect(p.isDown).toBe(false);
    expect(p.justReleased).toBe(true);
  });

  it('resetPointerFrame clears per-frame flags', () => {
    const p = createPointer();
    pointerDown(p, 5, 5);
    expect(p.justPressed).toBe(true);
    expect(p.delta).toEqual({ x: 5, y: 5 });

    resetPointerFrame(p);
    expect(p.justPressed).toBe(false);
    expect(p.justReleased).toBe(false);
    expect(p.delta).toEqual({ x: 0, y: 0 });
    // isDown persists
    expect(p.isDown).toBe(true);
  });

  it('full press-move-release cycle', () => {
    const p = createPointer();

    // Frame 1: press
    pointerDown(p, 100, 200);
    expect(p.justPressed).toBe(true);
    expect(p.isDown).toBe(true);

    // Frame 2: move
    resetPointerFrame(p);
    pointerMove(p, 110, 210);
    expect(p.justPressed).toBe(false);
    expect(p.isDown).toBe(true);
    expect(p.position).toEqual({ x: 110, y: 210 });

    // Frame 3: release
    resetPointerFrame(p);
    pointerUp(p, 115, 215);
    expect(p.justReleased).toBe(true);
    expect(p.isDown).toBe(false);

    // Frame 4: idle
    resetPointerFrame(p);
    expect(p.justReleased).toBe(false);
    expect(p.isDown).toBe(false);
  });
});
