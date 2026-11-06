import { describe, expect, it } from 'bun:test';
import { createTimeline, type TimelineWriter } from '../src/timeline.js';

const DT = 1 / 60;

/** Writer that stores `values[k]` in lane `k` of every element. */
function lanes(elementCount: number, values: number[]): TimelineWriter {
  const stride = values.length;
  return (buf, base) => {
    for (let i = 0; i < elementCount; i++) {
      for (let k = 0; k < stride; k++) buf[base + i * stride + k] = values[k]!;
    }
  };
}

describe('createTimeline', () => {
  it('starts empty with zero duration', () => {
    const t = createTimeline(2, DT);
    expect(t.elementCount).toBe(2);
    expect(t.frameCount).toBe(0);
    expect(t.duration).toBe(0);
  });

  it('counts frames and reports (frameCount - 1) * dt as duration', () => {
    const t = createTimeline(1, DT);
    t.record(lanes(1, [0, 0, 0]));
    expect(t.frameCount).toBe(1);
    expect(t.duration).toBe(0);
    for (let i = 0; i < 4; i++) t.record(lanes(1, [i, i, i]));
    expect(t.frameCount).toBe(5);
    expect(t.duration).toBeCloseTo(4 / 60, 12);
  });

  it('stops calling the writer once maxFrames is reached', () => {
    const t = createTimeline(1, DT, { maxFrames: 3 });
    let calls = 0;
    const writer: TimelineWriter = () => {
      calls++;
    };
    for (let i = 0; i < 5; i++) t.record(writer);
    expect(t.frameCount).toBe(3);
    expect(calls).toBe(3);
    expect(t.duration).toBeCloseTo(2 / 60, 12);
  });

  it('advances frameBase by elementCount * stride and lerps every lane', () => {
    const t = createTimeline(2, DT, { stride: 5 });
    const bases: number[] = [];
    const frame = (offset: number): TimelineWriter => {
      return (buf, base) => {
        bases.push(base);
        for (let o = 0; o < 10; o++) buf[base + o] = offset + o;
      };
    };
    t.record(frame(0));
    t.record(frame(100));
    expect(bases).toEqual([0, 10]);

    const out = new Float32Array(10);
    t.sampleInto(0.5, out);
    for (let o = 0; o < 10; o++) expect(out[o]).toBe(50 + o);
  });

  describe('record with until', () => {
    it('bakes in one call until the predicate returns true', () => {
      const t = createTimeline(1, DT, { maxFrames: 100 });
      let calls = 0;
      t.record(
        () => {
          calls++;
        },
        () => calls >= 7,
      );
      expect(calls).toBe(7);
      expect(t.frameCount).toBe(7);
    });

    it('stops at maxFrames when the predicate never settles', () => {
      const t = createTimeline(1, DT, { maxFrames: 20 });
      let calls = 0;
      t.record(
        () => {
          calls++;
        },
        () => false,
      );
      expect(calls).toBe(20);
      expect(t.frameCount).toBe(20);
      t.record(() => {
        calls++;
      });
      expect(calls).toBe(20);
    });

    it('records exactly one frame per call without a predicate', () => {
      const t = createTimeline(1, DT);
      let calls = 0;
      const writer: TimelineWriter = () => {
        calls++;
      };
      t.record(writer);
      expect(t.frameCount).toBe(1);
      t.record(writer);
      expect(t.frameCount).toBe(2);
      expect(calls).toBe(2);
    });
  });

  describe('sampleInto', () => {
    function threeFrames() {
      const t = createTimeline(2, DT);
      t.record(lanes(2, [0, 0, 0]));
      t.record(lanes(2, [10, 20.5, 1]));
      t.record(lanes(2, [30, 61.5, 2.2]));
      return t;
    }

    it('returns the first frame at 0 and the last at 1', () => {
      const t = threeFrames();
      const out = new Float32Array(6);
      t.sampleInto(0, out);
      expect(Array.from(out)).toEqual([0, 0, 0, 0, 0, 0]);
      t.sampleInto(1, out);
      expect(out[0]).toBe(30);
      expect(out[1]).toBe(61.5);
      expect(out[2]).toBeCloseTo(2.2, 6);
      expect(out[3]).toBe(30);
      expect(out[4]).toBe(61.5);
      expect(out[5]).toBeCloseTo(2.2, 6);
    });

    it('lerps between the bracketing frames at a midpoint', () => {
      const t = threeFrames();
      const out = new Float32Array(6);
      // f = 0.75 * 2 = 1.5: halfway between frame 1 and frame 2.
      t.sampleInto(0.75, out);
      expect(out[0]).toBe(20);
      expect(out[1]).toBe(41);
      expect(out[2]).toBeCloseTo(1.6, 6);
      expect(out[3]).toBe(20);
      expect(out[4]).toBe(41);
      expect(out[5]).toBeCloseTo(1.6, 6);
    });

    it('treats NaN as 0 and clamps progress outside [0, 1]', () => {
      const t = threeFrames();
      const out = new Float32Array(6);
      const first = new Float32Array(6);
      const last = new Float32Array(6);
      t.sampleInto(0, first);
      t.sampleInto(1, last);

      out.fill(99);
      t.sampleInto(Number.NaN, out);
      expect(Array.from(out)).toEqual(Array.from(first));
      t.sampleInto(-0.5, out);
      expect(Array.from(out)).toEqual(Array.from(first));
      t.sampleInto(1.5, out);
      expect(Array.from(out)).toEqual(Array.from(last));
    });

    it('writes zeros over the frame span before any frame is recorded', () => {
      const t = createTimeline(2, DT);
      const out = new Float32Array(8).fill(7);
      t.sampleInto(0.5, out);
      expect(Array.from(out)).toEqual([0, 0, 0, 0, 0, 0, 7, 7]);
    });

    it('copies the single frame at any progress when only one exists', () => {
      const t = createTimeline(1, DT);
      t.record(lanes(1, [4, -8, 0.5]));
      const out = new Float32Array(3);
      for (const p of [0, 0.3, 1]) {
        out.fill(99);
        t.sampleInto(p, out);
        expect(Array.from(out)).toEqual([4, -8, 0.5]);
      }
    });

    it('lerps a multi-turn unwrapped angle forward, never the short way back', () => {
      const t = createTimeline(1, DT);
      t.record(lanes(1, [0, 0, 0]));
      t.record(lanes(1, [0, 0, 3 * Math.PI]));
      t.record(lanes(1, [0, 0, 6 * Math.PI]));
      const out = new Float32Array(3);
      t.sampleInto(0.25, out);
      expect(out[2]).toBeCloseTo(1.5 * Math.PI, 5);
      t.sampleInto(0.75, out);
      expect(out[2]).toBeCloseTo(4.5 * Math.PI, 5);

      let prev = Number.NEGATIVE_INFINITY;
      for (let p = 0; p <= 1; p += 1 / 32) {
        t.sampleInto(p, out);
        expect(out[2]).toBeGreaterThanOrEqual(prev);
        prev = out[2]!;
      }
    });
  });

  describe('validation', () => {
    it('rejects an elementCount that is not an integer >= 0', () => {
      expect(() => createTimeline(-1, DT)).toThrow(RangeError);
      expect(() => createTimeline(-1, DT)).toThrow(/createTimeline: elementCount.*-1/);
      expect(() => createTimeline(1.5, DT)).toThrow(/createTimeline: elementCount.*1\.5/);
    });

    it('rejects a dt that is not a finite number > 0', () => {
      for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() => createTimeline(1, dt)).toThrow(RangeError);
        expect(() => createTimeline(1, dt)).toThrow(new RegExp(`createTimeline: dt.*${dt}`));
      }
    });

    it('rejects a stride that is not an integer >= 1', () => {
      expect(() => createTimeline(1, DT, { stride: 0 })).toThrow(RangeError);
      expect(() => createTimeline(1, DT, { stride: 0 })).toThrow(/createTimeline: stride.*0/);
      expect(() => createTimeline(1, DT, { stride: 1.5 })).toThrow(/createTimeline: stride.*1\.5/);
    });

    it('rejects a maxFrames that is not an integer >= 1', () => {
      expect(() => createTimeline(1, DT, { maxFrames: 0 })).toThrow(RangeError);
      expect(() => createTimeline(1, DT, { maxFrames: 0 })).toThrow(/createTimeline: maxFrames.*0/);
      expect(() => createTimeline(1, DT, { maxFrames: Number.NaN })).toThrow(
        /createTimeline: maxFrames.*NaN/,
      );
    });
  });

  it('never calls the writer with zero elements', () => {
    const t = createTimeline(0, DT);
    let calls = 0;
    const writer: TimelineWriter = () => {
      calls++;
    };
    t.record(writer);
    t.record(writer, () => false);
    expect(calls).toBe(0);
    expect(t.frameCount).toBe(0);
    expect(t.duration).toBe(0);
    const out = new Float32Array(2).fill(5);
    t.sampleInto(0.5, out);
    expect(Array.from(out)).toEqual([5, 5]);
  });
});
