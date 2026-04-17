import { describe, expect, test } from 'bun:test';
import { createFakeClock } from '../src/fake-clock.js';

describe('createFakeClock', () => {
  test('starts at time 0', () => {
    const c = createFakeClock();
    expect(c.now).toBe(0);
  });

  test('advance moves time forward in milliseconds', () => {
    const c = createFakeClock();
    c.advance(1);
    expect(c.now).toBe(1000);
    c.advance(0.5);
    expect(c.now).toBe(1500);
  });

  test('advance fires pending callbacks with current time', () => {
    const c = createFakeClock();
    const seen: number[] = [];
    c.requestFrame((t) => seen.push(t));
    c.advance(1 / 60);
    expect(seen.length).toBe(1);
    expect(seen[0]).toBeCloseTo(1000 / 60);
  });

  test('callbacks scheduled during a flush run on the NEXT advance', () => {
    const c = createFakeClock();
    const order: string[] = [];
    c.requestFrame(() => {
      order.push('first');
      c.requestFrame(() => order.push('second'));
    });
    c.advance(0.016);
    expect(order).toEqual(['first']);
    c.advance(0.016);
    expect(order).toEqual(['first', 'second']);
  });

  test('cancelFrame removes a pending callback', () => {
    const c = createFakeClock();
    let fired = false;
    const id = c.requestFrame(() => {
      fired = true;
    });
    c.cancelFrame(id);
    c.advance(1);
    expect(fired).toBe(false);
  });

  test('advance backwards throws', () => {
    const c = createFakeClock();
    expect(() => c.advance(-1)).toThrow();
  });

  test('reset clears time and callbacks', () => {
    const c = createFakeClock();
    c.requestFrame(() => {});
    c.advance(1);
    c.reset();
    expect(c.now).toBe(0);
    let fired = false;
    c.requestFrame(() => {
      fired = true;
    });
    c.advance(1);
    expect(fired).toBe(true);
  });
});
