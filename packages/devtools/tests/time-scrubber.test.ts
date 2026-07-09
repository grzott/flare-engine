import { describe, expect, test } from 'bun:test';
import type { GameLoop } from '@flare-engine/core';
import { createSnapshotRingBuffer } from '../src/ring-buffer.js';
import { TimeScrubber } from '../src/time-scrubber.js';

type StubLoop = { clock: { timescale: number } };
function makeLoop(): StubLoop {
  return { clock: { timescale: 1 } };
}
// TimeScrubber only reads/writes `loop.clock.timescale`; narrow stub is sufficient.
function asLoop(stub: StubLoop): GameLoop {
  return stub as unknown as GameLoop;
}

describe('TimeScrubber', () => {
  test('pause / resume toggle clock timescale', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer(4, () => 1);
    const scrub = new TimeScrubber({ loop: asLoop(loop), buffer });
    expect(scrub.paused).toBe(false);
    scrub.pause();
    expect(scrub.paused).toBe(true);
    expect(loop.clock.timescale).toBe(0);
    scrub.resume();
    expect(scrub.paused).toBe(false);
    expect(loop.clock.timescale).toBe(1);
  });

  test('step is consumed once', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer(4, () => 1);
    const scrub = new TimeScrubber({ loop: asLoop(loop), buffer });
    expect(scrub.consumeStep()).toBe(false);
    scrub.step();
    expect(scrub.consumeStep()).toBe(true);
    expect(scrub.consumeStep()).toBe(false);
  });

  test('rewind pauses and restores snapshot via callback', () => {
    const loop = makeLoop();
    let n = 0;
    const buffer = createSnapshotRingBuffer<number>(4, () => ++n);
    buffer.capture(); // 1
    buffer.capture(); // 2
    buffer.capture(); // 3

    const holder: { value: number | null } = { value: null };
    const scrub = new TimeScrubber<number>({
      loop: asLoop(loop),
      buffer,
      restore: (s) => {
        holder.value = s;
      },
    });

    expect(scrub.rewind(2)).toBe(1);
    expect(holder.value).toBe(1);
    expect(scrub.paused).toBe(true);
    expect(scrub.scrubbing).toBe(true);
    expect(scrub.scrubOffset).toBe(2);
  });

  test('rewind on empty buffer returns null', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer<number>(4, () => 1);
    const scrub = new TimeScrubber({ loop: asLoop(loop), buffer });
    expect(scrub.rewind(0)).toBeNull();
    expect(scrub.paused).toBe(false);
  });

  test('rewind clamps to available history', () => {
    const loop = makeLoop();
    let n = 0;
    const buffer = createSnapshotRingBuffer<number>(4, () => ++n);
    buffer.capture();
    buffer.capture();
    const holder: { value: number | null } = { value: null };
    const scrub = new TimeScrubber<number>({
      loop: asLoop(loop),
      buffer,
      restore: (s) => {
        holder.value = s;
      },
    });
    // Only 2 snapshots available; asking for 999 clamps to oldest (1).
    expect(scrub.rewind(999)).toBe(1);
    expect(holder.value).toBe(1);
  });

  test('resume clears scrub state', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer<number>(4, () => 1);
    buffer.capture();
    buffer.capture();
    const scrub = new TimeScrubber<number>({ loop: asLoop(loop), buffer });
    scrub.rewind(1);
    expect(scrub.scrubbing).toBe(true);
    scrub.resume();
    expect(scrub.scrubbing).toBe(false);
    expect(scrub.paused).toBe(false);
  });

  test('rejects invalid framesAgo', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer<number>(4, () => 1);
    buffer.capture();
    const scrub = new TimeScrubber<number>({ loop: asLoop(loop), buffer });
    expect(scrub.rewind(-1)).toBeNull();
    expect(scrub.rewind(Number.NaN)).toBeNull();
    expect(scrub.rewind(Number.POSITIVE_INFINITY)).toBeNull();
  });

  test('resume restores an active slow-motion timescale (not 1)', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer(4, () => 1);
    const scrub = new TimeScrubber({ loop: asLoop(loop), buffer });
    loop.clock.timescale = 0.5; // slow-mo active before pausing
    scrub.pause();
    expect(loop.clock.timescale).toBe(0);
    scrub.resume();
    // Pre-fix resume() hardcoded 1 → this would be 1, clobbering the slow-mo.
    expect(loop.clock.timescale).toBe(0.5);
  });

  test('double pause keeps the saved speed (does not freeze on resume)', () => {
    const loop = makeLoop();
    const buffer = createSnapshotRingBuffer(4, () => 1);
    const scrub = new TimeScrubber({ loop: asLoop(loop), buffer });
    loop.clock.timescale = 0.5;
    scrub.pause(); // saves 0.5, timescale → 0
    scrub.pause(); // already 0 → guard skips saving 0
    scrub.resume();
    // Without the `!== 0` guard the second pause would save 0 and freeze here.
    expect(loop.clock.timescale).toBe(0.5);
  });

  test('rewind then resume returns to the pre-rewind slow-motion speed', () => {
    const loop = makeLoop();
    let n = 0;
    const buffer = createSnapshotRingBuffer<number>(4, () => ++n);
    buffer.capture();
    buffer.capture();
    const scrub = new TimeScrubber<number>({ loop: asLoop(loop), buffer });
    loop.clock.timescale = 0.5;
    scrub.rewind(1); // calls pause() internally → saves 0.5
    expect(loop.clock.timescale).toBe(0);
    scrub.resume();
    expect(loop.clock.timescale).toBe(0.5);
  });
});
