import { describe, expect, it } from 'bun:test';
import { createStepSequence, resetStepSequence, tickStepSequence } from '../src/step-sequence.js';

describe('createStepSequence', () => {
  it('throws on empty steps', () => {
    expect(() => createStepSequence([])).toThrow('steps must not be empty');
  });

  it('throws when any duration is zero', () => {
    expect(() => createStepSequence([{ duration: 1 }, { duration: 0 }])).toThrow(
      'duration must be > 0',
    );
  });

  it('throws when any duration is negative', () => {
    expect(() => createStepSequence([{ duration: -0.1 }])).toThrow('duration must be > 0');
  });

  it('initialises current=0 and elapsed=0', () => {
    const seq = createStepSequence([{ duration: 1 }, { duration: 2 }]);
    expect(seq.current).toBe(0);
    expect(seq.elapsed).toBe(0);
    expect(seq.steps.length).toBe(2);
  });
});

describe('tickStepSequence', () => {
  it('advances elapsed without crossing step boundary', () => {
    const seq = createStepSequence([{ duration: 1 }, { duration: 1 }]);
    const idx = tickStepSequence(seq, 0.4);
    expect(idx).toBe(0);
    expect(seq.elapsed).toBeCloseTo(0.4, 10);
  });

  it('advances to next step when elapsed == duration (boundary)', () => {
    const seq = createStepSequence([{ duration: 0.5 }, { duration: 0.5 }]);
    // dt exactly equals the first step's duration — should wrap to step 1
    tickStepSequence(seq, 0.5);
    expect(seq.current).toBe(1);
    expect(seq.elapsed).toBeCloseTo(0, 10);
  });

  it('handles large dt spanning multiple steps — cyclic wrap', () => {
    const seq = createStepSequence([{ duration: 0.5 }, { duration: 0.5 }, { duration: 0.5 }]);
    // 3 steps × 0.5 = 1.5s per cycle; 3.7s = 2 full cycles + 0.7s
    // 0.7 / 0.5 = 1 full step consumed + 0.2 remainder → current = 1
    tickStepSequence(seq, 3.7);
    expect(seq.current).toBe(1);
    expect(seq.elapsed).toBeCloseTo(0.2, 5);
  });

  it('single-step sequence always stays on index 0', () => {
    const seq = createStepSequence([{ duration: 0.5 }]);
    tickStepSequence(seq, 5.0);
    expect(seq.current).toBe(0);
  });

  it('returns the new current index', () => {
    const seq = createStepSequence([{ duration: 0.2 }, { duration: 0.2 }, { duration: 0.2 }]);
    expect(tickStepSequence(seq, 0.25)).toBe(1);
  });

  it('accumulates elapsed across multiple ticks', () => {
    const seq = createStepSequence([{ duration: 1 }, { duration: 1 }]);
    tickStepSequence(seq, 0.6);
    tickStepSequence(seq, 0.6);
    // 1.2 total: stepped past the 1s boundary → current=1, elapsed≈0.2
    expect(seq.current).toBe(1);
    expect(seq.elapsed).toBeCloseTo(0.2, 5);
  });
});

describe('resetStepSequence', () => {
  it('resets current and elapsed to 0', () => {
    const seq = createStepSequence([{ duration: 0.5 }, { duration: 0.5 }]);
    tickStepSequence(seq, 0.7);
    expect(seq.current).toBe(1);
    resetStepSequence(seq);
    expect(seq.current).toBe(0);
    expect(seq.elapsed).toBe(0);
  });
});
