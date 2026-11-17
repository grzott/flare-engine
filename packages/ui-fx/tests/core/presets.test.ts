import { describe, expect, test } from 'bun:test';
import {
  disintegrate,
  dust,
  emerge,
  type ForceSpec,
  fade,
  isSnapshotPreset,
  liveFallbackOf,
  presetDuration,
  press,
  type ShatterPreset,
  shatter,
  slide,
} from '../../src/core/presets';
import { resolveSpring, springSettleTime } from '../../src/core/timing';

const DEFAULT_FORCE: ForceSpec = {
  kind: 'radial',
  origin: 'press',
  radius: 1.5,
  strength: 900,
  falloff: 'linear',
  angle: 0,
  spread: 30,
};

const SHATTER_DEFAULTS: ShatterPreset = {
  kind: 'shatter',
  fragment: {
    pattern: 'radial-glass',
    count: 40,
    cell: 4,
    distribution: 'uniform',
    focus: 'press',
    deviation: 0.2,
    jitter: 0.5,
    anisotropy: { x: 1, y: 1 },
    gap: 0,
    rotation: 0,
    seed: 1,
    subdivide: null,
  },
  forces: [DEFAULT_FORCE],
  release: { order: 'radial', duration: 0.15, softness: 0.5, timingRandomness: 0.2, angle: 90 },
  physics: {
    gravity: 1800,
    gravityAngle: 180,
    drag: 1.2,
    angularDrag: 0.8,
    spin: 360,
    randomness: 0.35,
    massVariance: 0.3,
    depth: 0,
    collide: 'none',
  },
  life: {
    opacity: [1, 0],
    scale: [1, 0.85],
    lifetime: 0.9,
    lifetimeVariance: 0.25,
    fadeStart: 0.55,
  },
  reverse: 'home',
  maxFragments: 300,
};

const isDeepFrozen = (value: unknown): boolean =>
  typeof value !== 'object' ||
  value === null ||
  (Object.isFrozen(value) && Object.values(value).every(isDeepFrozen));

describe('defaults', () => {
  test('fade', () => {
    expect(fade()).toEqual({ kind: 'fade', opacity: 0, duration: 0.25 });
  });

  test('slide', () => {
    expect(slide()).toEqual({
      kind: 'slide',
      from: 'bottom',
      distance: 48,
      path: null,
      alignOrigin: { x: 0.5, y: 0.5 },
      autoRotate: false,
      rotationLimit: 180,
      start: 0,
      end: 1,
      duration: 0.35,
      easing: 'easeOutCubic',
    });
  });

  test('press', () => {
    expect(press()).toEqual({
      kind: 'press',
      scale: 0.96,
      opacity: 1,
      brightness: 1,
      duration: 0.12,
    });
  });

  test('emerge', () => {
    expect(emerge()).toEqual({
      kind: 'emerge',
      variant: 'live',
      angle: 135,
      softness: 0.4,
      falloff: 'smoothstep',
      distance: 12,
      shadow: { color: '#000', opacity: 0.6, lag: 0.3, blur: 8, length: 0 },
      sheen: null,
      duration: 0.45,
    });
  });

  test('shatter', () => {
    expect(shatter()).toEqual(SHATTER_DEFAULTS);
  });

  test('disintegrate', () => {
    expect(disintegrate()).toEqual({
      ...SHATTER_DEFAULTS,
      kind: 'disintegrate',
      fragment: { ...SHATTER_DEFAULTS.fragment, pattern: 'cells', cell: 4 },
      release: { ...SHATTER_DEFAULTS.release, order: 'sweep', angle: 90, duration: 0.5 },
      maxFragments: 3000,
    });
  });

  test('dust', () => {
    expect(dust()).toEqual({
      kind: 'dust',
      sweepAngle: 90,
      noiseScale: 24,
      noiseAmount: 0.6,
      softness: 0.15,
      edgeWidth: 0.04,
      edgeColor: '#ffffff',
      spread: 48,
      grainsAtFront: 0,
      seed: 1,
      duration: 1.2,
    });
  });

  test('optional common fields are absent, not undefined, until given', () => {
    expect(Object.keys(fade()).sort()).toEqual(['duration', 'kind', 'opacity']);
    expect(Object.keys(shatter())).not.toContain('duration');
  });
});

describe('overrides', () => {
  test('partial overrides deep-merge', () => {
    const p = shatter({ physics: { gravity: 0 } });
    expect(p.physics.gravity).toBe(0);
    expect(p.physics.drag).toBe(1.2);
    expect(p.fragment).toEqual(SHATTER_DEFAULTS.fragment);
  });

  test('nested plain objects merge key by key', () => {
    expect(emerge({ shadow: { blur: 2 } }).shadow).toEqual({
      color: '#000',
      opacity: 0.6,
      lag: 0.3,
      blur: 2,
      length: 0,
    });
    expect(shatter({ fragment: { anisotropy: { x: 2 } } }).fragment.anisotropy).toEqual({
      x: 2,
      y: 1,
    });
    expect(slide({ alignOrigin: { y: 1 } }).alignOrigin).toEqual({ x: 0.5, y: 1 });
  });

  test('each given force merges over the default force; the list itself is replaced', () => {
    const p = shatter({ forces: [{ strength: 500 }, { kind: 'vortex', origin: 'center' }] });
    expect(p.forces).toEqual([
      { ...DEFAULT_FORCE, strength: 500 },
      { ...DEFAULT_FORCE, kind: 'vortex', origin: 'center' },
    ]);
    expect(shatter({ forces: [] }).forces).toEqual([]);
  });

  test('unions and tuples are replaced whole', () => {
    expect(slide({ from: { angle: 90, distance: 40 } }).from).toEqual({ angle: 90, distance: 40 });
    expect(shatter({ fragment: { focus: { x: 0.2, y: 0.5 } } }).fragment.focus).toEqual({
      x: 0.2,
      y: 0.5,
    });
    expect(shatter({ life: { opacity: [0.8, 0.1] } }).life.opacity).toEqual([0.8, 0.1]);
    const sheen = { width: 0.2, intensity: 0.5, color: '#fff', delay: 0.1 };
    expect(emerge({ sheen }).sheen).toEqual(sheen);
  });

  test('an explicit undefined keeps the default', () => {
    expect(fade({ opacity: undefined }).opacity).toBe(0);
    expect(shatter({ physics: { drag: undefined } }).physics.drag).toBe(1.2);
  });

  test('common fields pass through', () => {
    const p = fade({ delay: 0.1, easing: 'easeInQuad', reduceMotion: 'never' });
    expect(p).toEqual({
      kind: 'fade',
      opacity: 0,
      duration: 0.25,
      delay: 0.1,
      easing: 'easeInQuad',
      reduceMotion: 'never',
    });
  });

  test('a spring replaces the default duration and easing', () => {
    const p = slide({ from: 'right', spring: { duration: 0.4, bounce: 0.15 } });
    expect(p.spring).toEqual({ duration: 0.4, bounce: 0.15 });
    expect('duration' in p).toBe(false);
    expect('easing' in p).toBe(false);
  });

  test('disintegrate overrides merge over its own defaults', () => {
    const p = disintegrate({ fragment: { cell: 2 }, release: { softness: 0.1 } });
    expect(p.fragment.cell).toBe(2);
    expect(p.fragment.pattern).toBe('cells');
    expect(p.release).toEqual({
      order: 'sweep',
      duration: 0.5,
      softness: 0.1,
      timingRandomness: 0.2,
      angle: 90,
    });
  });
});

describe('frozen results', () => {
  test('every factory returns a deeply frozen object', () => {
    for (const p of [fade(), slide(), press(), emerge(), shatter(), disintegrate(), dust()]) {
      expect(isDeepFrozen(p)).toBe(true);
    }
  });

  test('caller-owned option objects are copied, not frozen or aliased', () => {
    const from = { angle: 90, distance: 40 };
    const forces = [{ strength: 500 }];
    const opacity: [number, number] = [1, 0.2];
    const a = slide({ from });
    const b = shatter({ forces, life: { opacity } });
    expect(Object.isFrozen(from)).toBe(false);
    expect(Object.isFrozen(forces)).toBe(false);
    expect(Object.isFrozen(opacity)).toBe(false);
    from.angle = 0;
    opacity[1] = 1;
    expect(a.from).toEqual({ angle: 90, distance: 40 });
    expect(b.life.opacity).toEqual([1, 0.2]);
    expect(isDeepFrozen(a)).toBe(true);
    expect(isDeepFrozen(b)).toBe(true);
  });

  test('two calls do not share nested objects with each other', () => {
    expect(shatter().physics).not.toBe(shatter().physics);
    expect(shatter().forces[0]).not.toBe(disintegrate().forces[0]);
  });
});

describe('validation', () => {
  const messageOf = (run: () => unknown): string => {
    try {
      run();
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      return (error as Error).message;
    }
    throw new Error('expected a throw');
  };

  test('fade opacity', () => {
    expect(messageOf(() => fade({ opacity: 2 }))).toBe('fade: opacity must be in 0..1, got 2');
  });

  test('shatter fragment.count', () => {
    expect(messageOf(() => shatter({ fragment: { count: 1 } }))).toBe(
      'shatter: fragment.count must be an integer in 2..300, got 1',
    );
    expect(messageOf(() => shatter({ fragment: { count: 2.5 } }))).toBe(
      'shatter: fragment.count must be an integer in 2..300, got 2.5',
    );
  });

  test('disintegrate cell', () => {
    expect(messageOf(() => disintegrate({ fragment: { cell: 0 } }))).toBe(
      'disintegrate: fragment.cell must be in 1..8, got 0',
    );
  });

  test('emerge softness', () => {
    expect(messageOf(() => emerge({ softness: -0.1 }))).toBe(
      'emerge: softness must be in 0..1, got -0.1',
    );
  });

  test('a spring with a duration or an easing', () => {
    expect(messageOf(() => slide({ duration: 0.2, spring: { duration: 0.3 } }))).toBe(
      'slide: a spring sets its own duration; do not combine it with duration or easing',
    );
    expect(() => fade({ easing: 'linear', spring: { duration: 0.3 } })).toThrow(RangeError);
  });

  test('an invalid spring is rejected when the preset is built', () => {
    expect(() => slide({ spring: { duration: 0 } })).toThrow(RangeError);
    expect(() => slide({ spring: { duration: 0.3, bounce: 1 } })).toThrow(RangeError);
  });

  test('unbounded fields still need a finite number', () => {
    expect(messageOf(() => fade({ duration: -1 }))).toBe(
      'fade: duration must be a finite number >= 0, got -1',
    );
    expect(messageOf(() => fade({ delay: Number.NaN }))).toBe(
      'fade: delay must be a finite number >= 0, got NaN',
    );
    expect(messageOf(() => emerge({ angle: Number.POSITIVE_INFINITY }))).toBe(
      'emerge: angle must be a finite number, got Infinity',
    );
    expect(messageOf(() => shatter({ fragment: { subdivide: { depth: 1.5 } } } as never))).toBe(
      'shatter: fragment.subdivide.depth must be an integer >= 0, got 1.5',
    );
  });

  test('nested and indexed fields are named by path', () => {
    expect(messageOf(() => shatter({ forces: [{}, { spread: -1 }] }))).toBe(
      'shatter: forces[1].spread must be a finite number >= 0, got -1',
    );
    expect(messageOf(() => shatter({ life: { opacity: [1, 2] } }))).toBe(
      'shatter: life.opacity[1] must be in 0..1, got 2',
    );
    expect(messageOf(() => emerge({ shadow: { lag: 1.5 } }))).toBe(
      'emerge: shadow.lag must be in 0..1, got 1.5',
    );
    expect(messageOf(() => slide({ from: { angle: 0, distance: -5 } }))).toBe(
      'slide: from.distance must be a finite number >= 0, got -5',
    );
    expect(messageOf(() => shatter({ fragment: { focus: { x: Number.NaN, y: 0 } } }))).toBe(
      'shatter: fragment.focus.x must be a finite number, got NaN',
    );
  });

  test('at most two forces', () => {
    expect(messageOf(() => shatter({ forces: [{}, {}, {}] }))).toBe(
      'shatter: forces.length must be an integer in 0..2, got 3',
    );
  });

  test('maxFragments stays inside the cap of its preset', () => {
    expect(messageOf(() => shatter({ maxFragments: 301 }))).toBe(
      'shatter: maxFragments must be an integer in 1..300, got 301',
    );
    expect(messageOf(() => disintegrate({ maxFragments: 3001 }))).toBe(
      'disintegrate: maxFragments must be an integer in 1..3000, got 3001',
    );
    expect(disintegrate({ maxFragments: 1200 }).maxFragments).toBe(1200);
  });

  test('ranges from the parameter model', () => {
    expect(() => shatter({ fragment: { deviation: 0.8 } })).toThrow(RangeError);
    expect(() => shatter({ fragment: { jitter: 1.1 } })).toThrow(RangeError);
    expect(() => disintegrate({ fragment: { cell: 9 } })).toThrow(RangeError);
    expect(() => press({ opacity: 1.5 })).toThrow(RangeError);
    expect(() => press({ scale: -1 })).toThrow(RangeError);
    expect(() => dust({ noiseAmount: 2 })).toThrow(RangeError);
    expect(() => dust({ softness: -1 })).toThrow(RangeError);
    expect(() => shatter({ physics: { drag: -1 } })).toThrow(RangeError);
    expect(() => shatter({ release: { timingRandomness: 2 } })).toThrow(RangeError);
    expect(() => shatter({ life: { fadeStart: 1.2 } })).toThrow(RangeError);
  });

  test('a non-number where a number belongs is rejected', () => {
    expect(() => fade({ opacity: '0.5' } as never)).toThrow(RangeError);
  });

  test('a fallback has to be a live preset', () => {
    expect(messageOf(() => shatter({ fallback: dust() } as never))).toBe(
      'shatter: fallback must be a live preset',
    );
  });

  test('boundary values pass', () => {
    expect(fade({ opacity: 1 }).opacity).toBe(1);
    expect(shatter({ fragment: { count: 2 } }).fragment.count).toBe(2);
    expect(shatter({ fragment: { count: 300 } }).fragment.count).toBe(300);
    expect(disintegrate({ fragment: { cell: 1 } }).fragment.cell).toBe(1);
    expect(shatter({ forces: [{ strength: -400 }] }).forces[0]?.strength).toBe(-400);
    expect(slide({ start: -0.2, end: 1.3 }).end).toBe(1.3);
  });
});

describe('isSnapshotPreset', () => {
  test('emerge depends on its variant', () => {
    expect(isSnapshotPreset(emerge({ variant: 'shader' }))).toBe(true);
    expect(isSnapshotPreset(emerge())).toBe(false);
  });

  test('fragment and dust presets are snapshots; fade, slide and press are live', () => {
    for (const p of [shatter(), disintegrate(), dust()]) expect(isSnapshotPreset(p)).toBe(true);
    for (const p of [fade(), slide(), press()]) expect(isSnapshotPreset(p)).toBe(false);
  });
});

describe('liveFallbackOf', () => {
  test('defaults to a short fade', () => {
    expect(liveFallbackOf(shatter())).toEqual(fade({ opacity: 0, duration: 0.15 }));
    expect(liveFallbackOf(slide())).toEqual(fade({ opacity: 0, duration: 0.15 }));
    expect(Object.isFrozen(liveFallbackOf(shatter()))).toBe(true);
  });

  test('returns the given fallback itself', () => {
    const fallback = slide();
    expect(liveFallbackOf(shatter({ fallback }))).toBe(fallback);
  });
});

describe('presetDuration', () => {
  test('duration plus delay', () => {
    expect(presetDuration(fade({ duration: 0.2, delay: 0.1 }))).toBeCloseTo(0.3, 12);
    expect(presetDuration(fade())).toBe(0.25);
    expect(presetDuration(dust())).toBe(1.2);
  });

  test('a spring lasts its settle time', () => {
    const spring = { duration: 0.4, bounce: 0.15 };
    expect(presetDuration(slide({ spring, delay: 0.5 }))).toBeCloseTo(
      0.5 + springSettleTime(resolveSpring(spring)),
      12,
    );
  });

  test('a fragment preset lasts its release plus the longest lifetime', () => {
    expect(presetDuration(shatter())).toBeCloseTo(0.15 + 0.9 * 1.25, 12);
    expect(presetDuration(disintegrate({ delay: 0.1 }))).toBeCloseTo(0.1 + 0.5 + 0.9 * 1.25, 12);
    expect(
      presetDuration(
        shatter({ release: { duration: 0 }, life: { lifetime: 1, lifetimeVariance: 0 } }),
      ),
    ).toBe(1);
  });
});
