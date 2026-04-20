import { describe, expect, test } from 'bun:test';
import { createSnapshotRingBuffer } from '../src/ring-buffer.js';

describe('createSnapshotRingBuffer', () => {
  test('throws on invalid size', () => {
    expect(() => createSnapshotRingBuffer(0, () => 0)).toThrow();
    expect(() => createSnapshotRingBuffer(-1, () => 0)).toThrow();
    expect(() => createSnapshotRingBuffer(Number.NaN, () => 0)).toThrow();
    expect(() => createSnapshotRingBuffer(Number.POSITIVE_INFINITY, () => 0)).toThrow();
  });

  test('length starts at 0, grows until size, then stays capped', () => {
    let n = 0;
    const buf = createSnapshotRingBuffer(3, () => ++n);
    expect(buf.length).toBe(0);
    expect(buf.latest).toBeNull();
    buf.capture();
    expect(buf.length).toBe(1);
    expect(buf.latest).toBe(1);
    buf.capture();
    buf.capture();
    expect(buf.length).toBe(3);
    buf.capture();
    expect(buf.length).toBe(3);
    expect(buf.latest).toBe(4);
  });

  test('rewind(0) returns latest, rewind(n) returns n frames back', () => {
    let n = 0;
    const buf = createSnapshotRingBuffer(4, () => ++n);
    buf.capture(); // 1
    buf.capture(); // 2
    buf.capture(); // 3
    expect(buf.rewind(0)).toBe(3);
    expect(buf.rewind(1)).toBe(2);
    expect(buf.rewind(2)).toBe(1);
  });

  test('rewind past available returns null', () => {
    const buf = createSnapshotRingBuffer(3, () => 1);
    expect(buf.rewind(0)).toBeNull();
    buf.capture();
    expect(buf.rewind(1)).toBeNull();
    expect(buf.rewind(-1)).toBeNull();
    expect(buf.rewind(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('rewind after wraparound returns correct values', () => {
    let n = 0;
    const buf = createSnapshotRingBuffer(3, () => ++n);
    buf.capture(); // 1
    buf.capture(); // 2
    buf.capture(); // 3
    buf.capture(); // 4 -> overwrites 1
    buf.capture(); // 5 -> overwrites 2
    expect(buf.latest).toBe(5);
    expect(buf.rewind(0)).toBe(5);
    expect(buf.rewind(1)).toBe(4);
    expect(buf.rewind(2)).toBe(3);
    // 1 and 2 were evicted
    expect(buf.rewind(3)).toBeNull();
  });

  test('reset clears all snapshots', () => {
    let n = 0;
    const buf = createSnapshotRingBuffer(3, () => ++n);
    buf.capture();
    buf.capture();
    buf.reset();
    expect(buf.length).toBe(0);
    expect(buf.latest).toBeNull();
    expect(buf.rewind(0)).toBeNull();
    buf.capture();
    expect(buf.latest).toBe(3);
  });

  test('does not allocate on capture after first fill', () => {
    const objs: { v: number }[] = [];
    const buf = createSnapshotRingBuffer(4, () => {
      const o = { v: objs.length };
      objs.push(o);
      return o;
    });
    for (let i = 0; i < 20; i++) buf.capture();
    expect(buf.length).toBe(4);
    expect(buf.latest?.v).toBe(19);
  });
});
