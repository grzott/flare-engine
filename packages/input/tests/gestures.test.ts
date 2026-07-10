import { describe, expect, it } from 'bun:test';
import type { SwipeEvent } from '../src/gestures.js';
import { GestureDetector } from '../src/gestures.js';

describe('GestureDetector', () => {
  it('detects a tap (short press, small movement)', () => {
    const g = new GestureDetector();
    const taps: { x: number; y: number }[] = [];
    g.onTap.add((pos) => taps.push(pos));

    g.pointerDown(100, 200);
    g.pointerUp(102, 201, 0.1); // Small movement, short time
    expect(taps).toHaveLength(1);
    expect(taps[0]).toEqual({ x: 102, y: 201 });
  });

  it('does not fire tap if movement too large', () => {
    const g = new GestureDetector();
    const taps: unknown[] = [];
    g.onTap.add((pos) => taps.push(pos));

    g.pointerDown(100, 200);
    g.pointerUp(200, 200, 0.1); // 100px movement
    expect(taps).toHaveLength(0);
  });

  it('does not fire tap if duration too long', () => {
    const g = new GestureDetector();
    const taps: unknown[] = [];
    g.onTap.add((pos) => taps.push(pos));

    g.pointerDown(100, 200);
    g.pointerUp(100, 200, 0.5); // Too long
    expect(taps).toHaveLength(0);
  });

  it('detects swipe right', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    g.onSwipe.add((e) => swipes.push(e));

    g.pointerDown(100, 200);
    g.pointerUp(200, 200, 0.2); // 100px right, fast
    expect(swipes).toHaveLength(1);
    expect(swipes[0]?.direction).toBe('right');
  });

  it('detects swipe left', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    g.onSwipe.add((e) => swipes.push(e));

    g.pointerDown(200, 200);
    g.pointerUp(100, 200, 0.2);
    expect(swipes[0]?.direction).toBe('left');
  });

  it('detects swipe up', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    g.onSwipe.add((e) => swipes.push(e));

    g.pointerDown(200, 200);
    g.pointerUp(200, 100, 0.2);
    expect(swipes[0]?.direction).toBe('up');
  });

  it('detects swipe down', () => {
    const g = new GestureDetector();
    const swipes: SwipeEvent[] = [];
    g.onSwipe.add((e) => swipes.push(e));

    g.pointerDown(200, 200);
    g.pointerUp(200, 300, 0.2);
    expect(swipes[0]?.direction).toBe('down');
  });

  it('does not fire swipe if too slow', () => {
    const g = new GestureDetector();
    const swipes: unknown[] = [];
    g.onSwipe.add((e) => swipes.push(e));

    g.pointerDown(100, 200);
    g.pointerUp(200, 200, 1.0); // Too slow
    expect(swipes).toHaveLength(0);
  });

  it('detects long press', () => {
    const g = new GestureDetector();
    const longPresses: { x: number; y: number }[] = [];
    g.onLongPress.add((pos) => longPresses.push(pos));

    g.pointerDown(100, 200);
    // Simulate holding for 0.6s
    g.update(0.3, 100, 200);
    expect(longPresses).toHaveLength(0);
    g.update(0.3, 100, 200);
    expect(longPresses).toHaveLength(1);
    expect(longPresses[0]).toEqual({ x: 100, y: 200 });
  });

  it('does not fire long press if finger moved', () => {
    const g = new GestureDetector();
    const longPresses: unknown[] = [];
    g.onLongPress.add((pos) => longPresses.push(pos));

    g.pointerDown(100, 200);
    g.update(0.6, 200, 200); // Moved 100px
    expect(longPresses).toHaveLength(0);
  });

  it('fires long press only once', () => {
    const g = new GestureDetector();
    const longPresses: unknown[] = [];
    g.onLongPress.add((pos) => longPresses.push(pos));

    g.pointerDown(100, 200);
    g.update(0.6, 100, 200);
    g.update(0.6, 100, 200);
    expect(longPresses).toHaveLength(1);
  });

  it('detects pinch', () => {
    const g = new GestureDetector();
    const pinches: { scale: number; center: { x: number; y: number } }[] = [];
    g.onPinch.add((e) => pinches.push(e));

    // Start pinch with 100px apart
    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(pinches).toHaveLength(0); // First call is baseline

    // Spread to 200px apart
    g.pinchUpdate({ x: -50, y: 0 }, { x: 150, y: 0 });
    expect(pinches).toHaveLength(1);
    expect(pinches[0]?.scale).toBeCloseTo(2.0);
    expect(pinches[0]?.center).toEqual({ x: 50, y: 0 });
  });

  it('pinchEnd resets pinch state', () => {
    const g = new GestureDetector();
    const pinches: unknown[] = [];
    g.onPinch.add((e) => pinches.push(e));

    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    g.pinchEnd();

    // New pinch should start fresh
    g.pinchUpdate({ x: 0, y: 0 }, { x: 50, y: 0 });
    g.pinchUpdate({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(pinches).toHaveLength(1);
    expect((pinches[0] as { scale: number }).scale).toBeCloseTo(2.0);
  });

  it('custom config overrides defaults', () => {
    const g = new GestureDetector({
      tapMaxDuration: 1.0,
      tapMaxDistance: 50,
    });
    const taps: unknown[] = [];
    g.onTap.add((pos) => taps.push(pos));

    // This would fail with defaults (>0.3s, >20px)
    g.pointerDown(100, 200);
    g.pointerUp(130, 200, 0.8); // 30px, 0.8s
    expect(taps).toHaveLength(1);
  });
});
