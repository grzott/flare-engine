import { describe, expect, it } from 'bun:test';
import { createGameClock, type GameClockConfig, type GameClockSegment } from '../src/index.js';

const segments: readonly GameClockSegment[] = [
  { name: 'night', phase: 'night', startMinute: 0, secondsPerGameHour: 120 },
  { name: 'dawn', phase: 'night', startMinute: 300, secondsPerGameHour: 120 },
  { name: 'day', phase: 'day', startMinute: 360, secondsPerGameHour: 86 },
  { name: 'dusk', phase: 'night', startMinute: 1200, secondsPerGameHour: 120 },
  { name: 'night', phase: 'night', startMinute: 1260, secondsPerGameHour: 120 },
];

const config: GameClockConfig = { segments };

function at(absoluteMinutes: number, extra?: Partial<GameClockConfig>) {
  return createGameClock({ ...config, ...extra }, { absoluteMinutes, paused: false });
}

describe('createGameClock — update', () => {
  it('runs the day segment at its own rate and lands exactly on 20:00', () => {
    const clock = at(360);
    expect(clock.segment).toBe('day');
    clock.update(1204);
    expect(clock.absoluteMinutes).toBe(1200);
    expect(clock.hour).toBe(20);
    expect(clock.minute).toBe(0);
    expect(clock.segment).toBe('dusk');
    expect(clock.phase).toBe('night');
  });

  it('runs the night at 120 s/h across midnight and lands at 06:00 next day', () => {
    const clock = at(1200);
    clock.update(1200);
    expect(clock.absoluteMinutes).toBe(1800);
    expect(clock.day).toBe(1);
    expect(clock.hour).toBe(6);
    expect(clock.minute).toBe(0);
    expect(clock.segment).toBe('day');
  });

  it('splits one step across a rate boundary', () => {
    const clock = at(1199);
    clock.update(86 / 60 + 2);
    expect(clock.absoluteMinutes).toBeCloseTo(1201, 9);
    expect(clock.segment).toBe('dusk');
  });

  it('ignores NaN, negative and zero dt', () => {
    const clock = at(100);
    clock.update(Number.NaN);
    clock.update(-1);
    clock.update(0);
    clock.update(Number.POSITIVE_INFINITY);
    expect(clock.absoluteMinutes).toBe(100);
  });
});

describe('createGameClock — pause', () => {
  it('blocks update but not advanceMinutes', () => {
    const clock = at(100);
    clock.pause();
    clock.pause();
    expect(clock.paused).toBe(true);
    clock.update(100);
    expect(clock.absoluteMinutes).toBe(100);
    clock.advanceMinutes(5);
    expect(clock.absoluteMinutes).toBe(105);
    clock.resume();
    clock.resume();
    expect(clock.paused).toBe(false);
    clock.update(120);
    expect(clock.absoluteMinutes).toBe(165);
  });
});

describe('createGameClock — skipTo', () => {
  it('jumps to the next start of the named segment', () => {
    const clock = at(600);
    clock.skipTo('dawn');
    expect(clock.absoluteMinutes).toBe(1740);
    expect(clock.day).toBe(1);
    expect(clock.hour).toBe(5);
    expect(clock.segment).toBe('dawn');
  });

  it('from exactly the segment start it lands a full day later', () => {
    const clock = at(300);
    clock.skipTo('dawn');
    expect(clock.absoluteMinutes).toBe(1740);
  });

  it('picks the nearest of a repeated name and never decreases', () => {
    const clock = at(1250);
    clock.skipTo('night');
    expect(clock.absoluteMinutes).toBe(1260);
    clock.skipTo('night');
    expect(clock.absoluteMinutes).toBe(1440);
    clock.skipTo('night');
    expect(clock.absoluteMinutes).toBe(2700);
  });

  it('throws on an unknown name', () => {
    const clock = at(0);
    expect(() => clock.skipTo('noon')).toThrow();
    expect(clock.absoluteMinutes).toBe(0);
  });
});

describe('createGameClock — hold', () => {
  it('stops at the next phase boundary and stays there', () => {
    const clock = at(1140);
    clock.hold();
    clock.hold();
    expect(clock.held).toBe(true);
    clock.update(10_000);
    expect(clock.absoluteMinutes).toBe(1200);
    expect(clock.phase).toBe('day');
    expect(clock.segment).toBe('day');
    clock.update(100);
    expect(clock.absoluteMinutes).toBe(1200);
    expect(clock.segment).toBe('day');
    clock.release();
    clock.release();
    expect(clock.held).toBe(false);
    clock.advanceMinutes(5);
    expect(clock.absoluteMinutes).toBe(1205);
    expect(clock.segment).toBe('dusk');
    expect(clock.phase).toBe('night');
  });

  it('still crosses segment boundaries inside the same phase', () => {
    const clock = at(240);
    clock.hold();
    clock.advanceMinutes(100);
    expect(clock.absoluteMinutes).toBe(340);
    expect(clock.segment).toBe('dawn');
    clock.advanceMinutes(100);
    expect(clock.absoluteMinutes).toBe(360);
    expect(clock.segment).toBe('dawn');
    expect(clock.phase).toBe('night');
  });

  it('a held clock stopped at midnight resumes from the last segment', () => {
    const table: readonly GameClockSegment[] = [
      { name: 'day', phase: 'day', startMinute: 0, secondsPerGameHour: 60 },
      { name: 'night', phase: 'night', startMinute: 720, secondsPerGameHour: 60 },
    ];
    const clock = createGameClock({ segments: table }, { absoluteMinutes: 1400, paused: false });
    clock.hold();
    clock.advanceMinutes(500);
    expect(clock.absoluteMinutes).toBe(1440);
    expect(clock.segment).toBe('night');
    clock.advanceMinutes(10);
    expect(clock.absoluteMinutes).toBe(1440);
    clock.release();
    clock.advanceMinutes(10);
    expect(clock.absoluteMinutes).toBe(1450);
    expect(clock.segment).toBe('day');
  });
});

describe('createGameClock — callbacks', () => {
  it('fires segment then phase changes in order, after the state moved', () => {
    const log: string[] = [];
    const clock = at(240, {
      onSegmentChange: (segment, previous) => {
        log.push(`segment ${previous}→${segment}`);
        expect(clock.segment).toBe(segment);
      },
      onPhaseChange: (phase, previous) => {
        log.push(`phase ${previous}→${phase}`);
        expect(clock.phase).toBe(phase);
        expect(clock.absoluteMinutes).toBe(360);
      },
    });
    clock.advanceMinutes(180);
    expect(clock.absoluteMinutes).toBe(420);
    expect(log).toEqual(['segment night→dawn', 'segment dawn→day', 'phase night→day']);
  });

  it('crossing midnight night→night fires no callback', () => {
    const log: string[] = [];
    const clock = at(1400, {
      onSegmentChange: (segment, previous) => {
        log.push(`segment ${previous}→${segment}`);
      },
      onPhaseChange: (phase, previous) => {
        log.push(`phase ${previous}→${phase}`);
      },
    });
    clock.advanceMinutes(60);
    expect(clock.absoluteMinutes).toBe(1460);
    expect(clock.day).toBe(1);
    expect(clock.segment).toBe('night');
    expect(log).toEqual([]);
  });

  it('does not fire while held at a phase boundary, and fires once released', () => {
    const log: string[] = [];
    const clock = at(1190, {
      onPhaseChange: (phase, previous) => {
        log.push(`${previous}→${phase}`);
      },
    });
    clock.hold();
    clock.advanceMinutes(100);
    expect(log).toEqual([]);
    clock.release();
    clock.advanceMinutes(0);
    expect(log).toEqual(['day→night']);
    expect(clock.absoluteMinutes).toBe(1200);
  });
});

describe('createGameClock — serialize / restore', () => {
  it('round-trips absoluteMinutes and paused and re-derives the segment', () => {
    const clock = at(1234.5);
    clock.pause();
    clock.hold();
    const state = clock.serialize();
    expect(state).toEqual({ absoluteMinutes: 1234.5, paused: true });
    const restored = createGameClock(config, state);
    expect(restored.absoluteMinutes).toBe(1234.5);
    expect(restored.paused).toBe(true);
    expect(restored.held).toBe(false);
    expect(restored.segment).toBe('dusk');
    expect(restored.phase).toBe('night');
  });

  it('starts at day 0 00:00 unpaused without a state', () => {
    const clock = createGameClock(config);
    expect(clock.absoluteMinutes).toBe(0);
    expect(clock.paused).toBe(false);
    expect(clock.segment).toBe('night');
  });
});

describe('createGameClock — validation', () => {
  const seg = (startMinute: number, secondsPerGameHour = 60): GameClockSegment => ({
    name: `s${startMinute}`,
    phase: 'p',
    startMinute,
    secondsPerGameHour,
  });

  it('rejects an empty table', () => {
    expect(() => createGameClock({ segments: [] })).toThrow();
  });

  it('rejects a first start other than 0', () => {
    expect(() => createGameClock({ segments: [seg(10)] })).toThrow();
  });

  it('rejects out-of-order and duplicate starts', () => {
    expect(() => createGameClock({ segments: [seg(0), seg(600), seg(300)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0), seg(300), seg(300)] })).toThrow();
  });

  it('rejects starts >= 1440 and non-integer starts', () => {
    expect(() => createGameClock({ segments: [seg(0), seg(1440)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0), seg(300.5)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0), seg(Number.NaN)] })).toThrow();
  });

  it('rejects rates that are 0, negative, NaN or Infinity', () => {
    expect(() => createGameClock({ segments: [seg(0, 0)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0, -1)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0, Number.NaN)] })).toThrow();
    expect(() => createGameClock({ segments: [seg(0, Number.POSITIVE_INFINITY)] })).toThrow();
  });

  it('rejects a negative or NaN restored absoluteMinutes', () => {
    expect(() => createGameClock(config, { absoluteMinutes: -1, paused: false })).toThrow();
    expect(() => createGameClock(config, { absoluteMinutes: Number.NaN, paused: false })).toThrow();
  });

  it('advanceMinutes throws RangeError on negative or NaN', () => {
    const clock = at(0);
    expect(() => clock.advanceMinutes(-1)).toThrow(RangeError);
    expect(() => clock.advanceMinutes(Number.NaN)).toThrow(RangeError);
    expect(clock.absoluteMinutes).toBe(0);
  });
});

describe('createGameClock — readouts', () => {
  it('derives day / hour / minute from a fractional absolute time', () => {
    const clock = at(1500.7);
    expect(clock.day).toBe(1);
    expect(clock.hour).toBe(1);
    expect(clock.minute).toBe(0);
    clock.advanceMinutes(59);
    expect(clock.hour).toBe(1);
    expect(clock.minute).toBe(59);
  });
});

describe('createGameClock — allocation', () => {
  it('update does not grow the heap in steady state', () => {
    const clock = at(0, {
      onSegmentChange: () => {},
      onPhaseChange: () => {},
    });
    for (let i = 0; i < 2_000; i++) clock.update(0.5);

    Bun.gc(true);
    const before = process.memoryUsage().heapUsed;
    for (let i = 0; i < 20_000; i++) clock.update(0.5);
    Bun.gc(true);
    const after = process.memoryUsage().heapUsed;

    expect(after - before).toBeLessThan(256 * 1024);
    expect(clock.day).toBeGreaterThan(2);
  });
});
