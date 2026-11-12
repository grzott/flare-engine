import { describe, expect, it } from 'bun:test';
import type { Vec2 } from '@flare-engine/math';
import type { PinchEvent, SwipeEvent } from '../src/gestures.js';
import { GestureDetector } from '../src/gestures.js';

interface Internals {
  _startPos: Vec2;
  _pinchActive?: unknown;
  _pinchTouches?: unknown;
}

function internals(g: GestureDetector): Internals {
  return g as unknown as Internals;
}

describe('GestureDetector start position', () => {
  it('pointerDown writes the same vector in place on every press', () => {
    const g = new GestureDetector();
    const initial = internals(g)._startPos;
    g.pointerDown(100, 200);
    expect(internals(g)._startPos).toBe(initial);
    expect(internals(g)._startPos).toEqual({ x: 100, y: 200 });
    g.pointerUp(100, 200, 0.1);
    g.pointerDown(300, 50);
    expect(internals(g)._startPos).toBe(initial);
    expect(internals(g)._startPos).toEqual({ x: 300, y: 50 });
  });

  it('a swipe after a second press measures from the second press', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    const taps: Vec2[] = [];
    g.onSwipe.add((e) => swipes.push(e));
    g.onTap.add((p) => taps.push(p));

    g.pointerDown(0, 0);
    g.pointerUp(0, 0, 0.1);
    expect(taps).toHaveLength(1);

    g.pointerDown(500, 500);
    g.pointerUp(500, 380, 0.2);
    expect(swipes).toHaveLength(1);
    expect(swipes[0]?.direction).toBe('up');
    expect(swipes[0]?.distance).toBeCloseTo(120);
    expect(taps).toHaveLength(1);
  });

  it('a tap after a second press measures from the second press', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    const taps: Vec2[] = [];
    g.onSwipe.add((e) => swipes.push(e));
    g.onTap.add((p) => taps.push(p));

    g.pointerDown(0, 0);
    g.pointerUp(200, 0, 0.1);
    expect(swipes).toHaveLength(1);

    g.pointerDown(400, 300);
    g.pointerUp(403, 302, 0.1);
    expect(taps).toEqual([{ x: 403, y: 302 }]);
    expect(swipes).toHaveLength(1);
  });

  it('a long press after a second press measures from the second press', () => {
    const g = new GestureDetector();
    const presses: Vec2[] = [];
    g.onLongPress.add((p) => presses.push(p));

    g.pointerDown(0, 0);
    g.pointerUp(0, 0, 0.1);
    g.pointerDown(400, 300);
    g.update(0.6, 402, 301);
    expect(presses).toEqual([{ x: 402, y: 301 }]);
  });

  it('tap and long-press listeners never receive the internal start vector', () => {
    const g = new GestureDetector();
    const seen: Vec2[] = [];
    g.onTap.add((p) => seen.push(p));
    g.onLongPress.add((p) => seen.push(p));

    g.pointerDown(10, 10);
    g.pointerUp(10, 10, 0.1);
    g.pointerDown(20, 20);
    g.update(0.6, 20, 20);
    g.pointerUp(20, 20);

    expect(seen).toHaveLength(2);
    for (const p of seen) expect(p).not.toBe(internals(g)._startPos);
    expect(seen[0]).toEqual({ x: 10, y: 10 });
  });
});

describe('GestureDetector pinch flag', () => {
  it('emits onPinch with the same scale and center', () => {
    const g = new GestureDetector();
    const pinches: PinchEvent[] = [];
    g.onPinch.add((e) => pinches.push(e));

    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(pinches).toHaveLength(0);

    g.pinchUpdate({ x: -50, y: 20 }, { x: 150, y: 40 });
    expect(pinches).toHaveLength(1);
    expect(pinches[0]?.scale).toBeCloseTo(Math.sqrt(200 * 200 + 20 * 20) / 100);
    expect(pinches[0]?.center).toEqual({ x: 50, y: 30 });

    g.pinchUpdate({ x: 25, y: 0 }, { x: 75, y: 0 });
    expect(pinches).toHaveLength(2);
    expect(pinches[1]?.scale).toBeCloseTo(0.5);
    expect(pinches[1]?.center).toEqual({ x: 50, y: 0 });
    expect(pinches[1]).not.toBe(pinches[0] as PinchEvent);
    expect(pinches[1]?.center).not.toBe(pinches[0]?.center as Vec2);
  });

  it('tracks an active pinch with a boolean, keeping no copy of the touches', () => {
    const g = new GestureDetector();
    expect(internals(g)._pinchActive).toBe(false);
    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(internals(g)._pinchActive).toBe(true);
    expect('_pinchTouches' in g).toBe(false);
    g.pinchEnd();
    expect(internals(g)._pinchActive).toBe(false);
  });

  it('a pinch that starts with both touches on one point never emits', () => {
    const g = new GestureDetector();
    const pinches: PinchEvent[] = [];
    g.onPinch.add((e) => pinches.push(e));

    g.pinchUpdate({ x: 10, y: 10 }, { x: 10, y: 10 });
    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    g.pinchUpdate({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(pinches).toHaveLength(0);

    g.pinchEnd();
    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    g.pinchUpdate({ x: 0, y: 0 }, { x: 200, y: 0 });
    expect(pinches).toHaveLength(1);
    expect(pinches[0]?.scale).toBeCloseTo(2);
  });
});
