import { describe, expect, test } from 'bun:test';
import {
  disintegrate,
  dust,
  emerge,
  fade,
  presetDuration,
  shatter,
  slide,
} from '../../src/core/presets';
import { createPresetRegistry } from '../../src/core/registry';
import {
  delay,
  type FlareTimeline,
  liveEntries,
  parallel,
  sequence,
  snapshotEntry,
  stagger,
} from '../../src/core/timeline';

const expectStarts = (tl: FlareTimeline, expected: readonly number[]): void => {
  expect(tl.entries.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(tl.entries[i]!.start).toBeCloseTo(expected[i]!, 12);
  }
};

const messageOf = (run: () => unknown): string => {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(RangeError);
  return (thrown as Error).message;
};

describe('sequence', () => {
  test('each item starts when the one before it ends', () => {
    const a = fade({ duration: 0.1 });
    const b = slide({ duration: 0.2 });
    const tl = sequence(a, delay(0.05), b);
    expect(tl.kind).toBe('timeline');
    expectStarts(tl, [0, 0.15]);
    expect(tl.entries[0]!.preset).toBe(a);
    expect(tl.entries[1]!.preset).toBe(b);
    expect(tl.duration).toBeCloseTo(0.35, 12);
  });

  test("a preset's own delay is part of its slot", () => {
    const tl = sequence(fade({ duration: 0.1, delay: 0.2 }), fade({ duration: 0.1 }));
    expectStarts(tl, [0, 0.3]);
    expect(tl.duration).toBeCloseTo(0.4, 12);
  });

  test('no items is an empty timeline', () => {
    const tl = sequence();
    expect(tl.entries).toEqual([]);
    expect(tl.duration).toBe(0);
  });
});

describe('parallel', () => {
  test('every item starts at 0 and the duration is the maximum', () => {
    const tl = parallel(fade({ duration: 0.1 }), slide({ duration: 0.4 }), fade({ duration: 0.2 }));
    expectStarts(tl, [0, 0, 0]);
    expect(tl.duration).toBe(0.4);
  });

  test('a delay can be the longest item', () => {
    expect(parallel(fade({ duration: 0.1 }), delay(0.5)).duration).toBe(0.5);
  });
});

describe('stagger', () => {
  test('items start one step apart', () => {
    const a = fade({ duration: 0.1 });
    const b = fade({ duration: 0.1 });
    const c = fade({ duration: 0.1 });
    const tl = stagger(0.04, a, b, c);
    expectStarts(tl, [0, 0.04, 0.08]);
    expect(tl.duration).toBeCloseTo(0.18, 12);
  });

  test('the duration is the latest end, not the last item', () => {
    const tl = stagger(0.04, fade({ duration: 1 }), fade({ duration: 0.1 }));
    expect(tl.duration).toBe(1);
  });

  test('a negative or non-finite step throws', () => {
    expect(messageOf(() => stagger(-0.1, fade()))).toBe(
      'stagger: step must be a finite number >= 0, got -0.1',
    );
    expect(() => stagger(Number.NaN, fade())).toThrow(RangeError);
  });
});

describe('delay', () => {
  test('is an empty timeline of that length', () => {
    const tl = delay(0.3);
    expect(tl.kind).toBe('timeline');
    expect(tl.entries).toEqual([]);
    expect(tl.duration).toBe(0.3);
  });

  test('a negative or non-finite length throws', () => {
    expect(messageOf(() => delay(-1))).toBe('delay: seconds must be a finite number >= 0, got -1');
    expect(() => delay(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('nesting', () => {
  test('nested timelines flatten with offsets', () => {
    const a = fade({ duration: 0.1 });
    const b = fade({ duration: 0.2 });
    const c = slide({ duration: 0.3 });
    const d = fade({ duration: 0.1 });
    const tl = sequence(a, parallel(b, sequence(delay(0.05), c)), d);
    expectStarts(tl, [0, 0.1, 0.15, 0.45]);
    expect(tl.entries.map((entry) => entry.preset)).toEqual([a, b, c, d]);
    expect(tl.entries.every((entry) => entry.preset.kind !== undefined)).toBe(true);
    expect(tl.duration).toBeCloseTo(0.55, 12);
  });

  test('a nested timeline is left as it was', () => {
    const inner = sequence(fade({ duration: 0.1 }), fade({ duration: 0.1 }));
    sequence(delay(1), inner);
    expectStarts(inner, [0, 0.1]);
  });

  test('stagger offsets a nested timeline as one item', () => {
    const tl = stagger(0.5, fade({ duration: 0.1 }), sequence(delay(0.1), fade({ duration: 0.1 })));
    expectStarts(tl, [0, 0.6]);
    expect(tl.duration).toBeCloseTo(0.7, 12);
  });
});

describe('the snapshot rule', () => {
  test('nothing can follow a snapshot step', () => {
    expect(messageOf(() => sequence(shatter(), fade()))).toBe(
      'ui-fx: nothing can follow a snapshot step',
    );
    expect(messageOf(() => stagger(0.04, dust(), fade()))).toBe(
      'ui-fx: nothing can follow a snapshot step',
    );
    expect(messageOf(() => sequence(fade(), sequence(shatter(), delay(0.1)), fade()))).toBe(
      'ui-fx: nothing can follow a snapshot step',
    );
  });

  test('a second snapshot step throws wherever it starts', () => {
    expect(messageOf(() => sequence(shatter(), dust()))).toBe(
      'ui-fx: nothing can follow a snapshot step',
    );
    expect(messageOf(() => parallel(shatter(), dust()))).toBe(
      'ui-fx: a timeline takes one snapshot step at most',
    );
    expect(messageOf(() => stagger(0.1, emerge({ variant: 'shader' }), shatter()))).toBe(
      'ui-fx: nothing can follow a snapshot step',
    );
  });

  test('live steps may lead into a snapshot step', () => {
    const lead = fade({ opacity: 0.7, duration: 0.06 });
    const exit = disintegrate();
    const tl = sequence(lead, exit);
    const snapshot = snapshotEntry(tl);
    expect(snapshot).not.toBeNull();
    expect(snapshot!.start).toBeCloseTo(0.06, 12);
    expect(snapshot!.preset).toBe(exit);
    expect(tl.duration).toBeCloseTo(0.06 + presetDuration(exit), 12);
  });

  test('a snapshot step may be the latest of several parallel steps', () => {
    const tl = parallel(sequence(delay(0.1), shatter()), fade({ duration: 0.05 }));
    expect(snapshotEntry(tl)!.start).toBe(0.1);
  });

  test('a live step whose summed start rounds just past the snapshot step is accepted', () => {
    expect(0.1 + 0.2).toBeGreaterThan(0.3);
    const tl = parallel(
      sequence(fade({ duration: 0.3 }), shatter()),
      sequence(fade({ duration: 0.1 }), fade({ duration: 0.2 }), fade()),
    );
    expect(snapshotEntry(tl)!.start).toBe(0.3);
    expect(tl.entries[4]!.start).toBe(0.1 + 0.2);
  });

  test('a snapshot step whose summed start rounds just past a live step is accepted', () => {
    const tl = parallel(
      sequence(fade({ duration: 0.1 }), fade({ duration: 0.2 }), shatter()),
      sequence(delay(0.3), fade()),
    );
    expect(snapshotEntry(tl)!.start).toBe(0.1 + 0.2);
    expect(tl.entries[3]!.start).toBe(0.3);
  });

  test('a step that starts 0.01 s after the snapshot step still throws', () => {
    expect(
      messageOf(() =>
        parallel(sequence(fade({ duration: 0.3 }), shatter()), sequence(delay(0.31), fade())),
      ),
    ).toBe('ui-fx: nothing can follow a snapshot step');
  });

  test('a second snapshot step at a rounded-equal start is still a second snapshot step', () => {
    expect(
      messageOf(() =>
        parallel(
          sequence(delay(0.3), shatter()),
          sequence(fade({ duration: 0.1 }), fade({ duration: 0.2 }), dust()),
        ),
      ),
    ).toBe('ui-fx: a timeline takes one snapshot step at most');
  });
});

describe('snapshotEntry', () => {
  test('is null for a live timeline', () => {
    expect(snapshotEntry(sequence(fade(), slide()))).toBeNull();
    expect(snapshotEntry(delay(1))).toBeNull();
  });

  test('a shader emerge counts, a live emerge does not', () => {
    expect(snapshotEntry(sequence(emerge()))).toBeNull();
    const shader = emerge({ variant: 'shader' });
    expect(snapshotEntry(sequence(shader))!.preset).toBe(shader);
  });
});

describe('liveEntries', () => {
  test('a live timeline gives every entry', () => {
    const tl = sequence(fade({ duration: 0.1 }), slide({ duration: 0.2 }));
    const live = liveEntries(tl);
    expect(live.map((entry) => entry.start)).toEqual(tl.entries.map((entry) => entry.start));
    expect(live.length).toBe(2);
    expect(live[0]!.preset === tl.entries[0]!.preset).toBe(true);
    expect(live[1]!.preset === tl.entries[1]!.preset).toBe(true);
  });

  test('gives the live entries that start before the snapshot entry', () => {
    const lead = fade({ opacity: 0.7, duration: 0.06 });
    const tl = sequence(lead, disintegrate());
    const live = liveEntries(tl);
    expect(live.length).toBe(1);
    expect(live[0]!.start).toBe(0);
    expect(live[0]!.preset).toBe(lead);
  });

  test('leaves out a live entry that starts with the snapshot entry', () => {
    const early = fade({ duration: 0.1 });
    const tl = sequence(early, parallel(shatter(), slide()));
    expect(liveEntries(tl).map((entry) => entry.preset)).toEqual([early]);
  });

  test('leaves out a live entry whose summed start rounds just past the snapshot entry', () => {
    const lead = fade({ duration: 0.3 });
    const first = fade({ duration: 0.1 });
    const second = fade({ duration: 0.2 });
    const tl = parallel(sequence(lead, shatter()), sequence(first, second, fade()));
    expect(liveEntries(tl).map((entry) => entry.preset)).toEqual([lead, first, second]);
  });

  test('leaves out a live entry that starts just before a rounded-up snapshot entry', () => {
    const first = fade({ duration: 0.1 });
    const second = fade({ duration: 0.2 });
    const tl = parallel(sequence(first, second, shatter()), sequence(delay(0.3), fade()));
    expect(liveEntries(tl).map((entry) => entry.preset)).toEqual([first, second]);
  });

  test('keeps a live entry that starts 0.01 s before the snapshot entry', () => {
    const late = fade({ duration: 0.01 });
    const tl = parallel(sequence(delay(0.3), shatter()), sequence(delay(0.29), late));
    expect(liveEntries(tl).map((entry) => entry.preset)).toEqual([late]);
  });
});

describe('immutability', () => {
  test('a timeline and its entries are frozen', () => {
    const tl = sequence(fade(), slide());
    expect(Object.isFrozen(tl)).toBe(true);
    expect(Object.isFrozen(tl.entries)).toBe(true);
    expect(Object.isFrozen(tl.entries[0])).toBe(true);
  });
});

describe('registry', () => {
  test('a timeline registers and resolves by name', () => {
    const registry = createPresetRegistry();
    const tl = sequence(fade({ duration: 0.06 }), disintegrate());
    registry.register('delete', tl);
    expect(registry.resolve('delete')).toBe(tl);
  });

  test('a timeline passed directly resolves to itself', () => {
    const tl = stagger(0.04, fade(), fade());
    expect(createPresetRegistry().resolve(tl)).toBe(tl);
  });
});
