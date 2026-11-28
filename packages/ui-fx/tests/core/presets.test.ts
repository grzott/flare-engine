import { describe, expect, test } from 'bun:test';
import {
  disintegrate,
  dust,
  emerge,
  type ForceSpec,
  fade,
  flip,
  isSnapshotPreset,
  type LivePreset,
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

  test('flip', () => {
    expect(flip()).toEqual({
      kind: 'flip',
      axis: 'y',
      angle: 90,
      perspective: 800,
      origin: 'center',
      fadeAtEdge: true,
      duration: 0.45,
      easing: 'easeOutCubic',
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

  // Both presets share one default force today, so this cannot tell a preset's own base force
  // from shatter's; it pins that an empty force is the preset's default force either way.
  test('an empty force is the default force of the preset it is given to', () => {
    expect(shatter({ forces: [{}] }).forces).toEqual(shatter().forces);
    expect(disintegrate({ forces: [{}] }).forces).toEqual(disintegrate().forces);
    expect(disintegrate({ forces: [{ strength: 200 }] }).forces).toEqual([
      { ...DEFAULT_FORCE, strength: 200 },
    ]);
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
    for (const p of [
      fade(),
      slide(),
      press(),
      emerge(),
      flip(),
      shatter(),
      disintegrate(),
      dust(),
    ]) {
      expect(isDeepFrozen(p)).toBe(true);
    }
  });

  test('a flip copies the origin it is given', () => {
    const origin = { x: 0, y: 0.5 };
    const p = flip({ origin });
    expect(Object.isFrozen(origin)).toBe(false);
    origin.x = 1;
    expect(p.origin).toEqual({ x: 0, y: 0.5 });
    expect(isDeepFrozen(p)).toBe(true);
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

  test('a caller object that is already frozen is still copied deeply', () => {
    const cubic = [0, 0, 10, 0, 20, 0, 30, 0];
    const path = Object.freeze({ cubic });
    const p = slide({ path });
    expect(p.path).not.toBe(path);
    cubic[0] = 99;
    expect(p.path).toEqual({ cubic: [0, 0, 10, 0, 20, 0, 30, 0] });
    expect(isDeepFrozen(p)).toBe(true);
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

  test('disintegrate fragment.count is capped at the cell cap, not the shard cap', () => {
    expect(messageOf(() => disintegrate({ fragment: { count: 3001 } }))).toBe(
      'disintegrate: fragment.count must be an integer in 2..3000, got 3001',
    );
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

  test('flip angle stays within half a turn either way', () => {
    const wanted = (got: string) => `flip: angle must be in -180..180, got ${got}`;
    expect(messageOf(() => flip({ angle: 181 }))).toBe(wanted('181'));
    expect(messageOf(() => flip({ angle: -180.5 }))).toBe(wanted('-180.5'));
    expect(messageOf(() => flip({ angle: Number.NaN }))).toBe(wanted('NaN'));
    expect(messageOf(() => flip({ angle: Number.POSITIVE_INFINITY }))).toBe(wanted('Infinity'));
    expect(messageOf(() => flip({ angle: Number.NEGATIVE_INFINITY }))).toBe(wanted('-Infinity'));
    expect(messageOf(() => flip({ angle: '90' } as never))).toBe(wanted('90'));
  });

  test('flip perspective is at least 100', () => {
    const wanted = (got: string) => `flip: perspective must be a finite number >= 100, got ${got}`;
    expect(messageOf(() => flip({ perspective: 50 }))).toBe(wanted('50'));
    expect(messageOf(() => flip({ perspective: 99.9 }))).toBe(wanted('99.9'));
    expect(messageOf(() => flip({ perspective: 0 }))).toBe(wanted('0'));
    expect(messageOf(() => flip({ perspective: -800 }))).toBe(wanted('-800'));
    expect(messageOf(() => flip({ perspective: Number.NaN }))).toBe(wanted('NaN'));
    expect(messageOf(() => flip({ perspective: Number.POSITIVE_INFINITY }))).toBe(
      wanted('Infinity'),
    );
  });

  test('flip origin has to be an origin', () => {
    expect(messageOf(() => flip({ origin: { x: Number.NaN, y: 0 } }))).toBe(
      'flip: origin.x must be a finite number, got NaN',
    );
    expect(messageOf(() => flip({ origin: { x: 0, y: Number.POSITIVE_INFINITY } }))).toBe(
      'flip: origin.y must be a finite number, got Infinity',
    );
    expect(messageOf(() => flip(JSON.parse('{"origin":3}') as Parameters<typeof flip>[0]))).toBe(
      "flip: origin must be 'center', 'press' or { x, y }, got 3",
    );
  });

  test('flip takes the common timing checks', () => {
    expect(messageOf(() => flip({ duration: -1 }))).toBe(
      'flip: duration must be a finite number >= 0, got -1',
    );
    expect(messageOf(() => flip({ duration: 0.2, spring: { duration: 0.3 } }))).toBe(
      'flip: a spring sets its own duration; do not combine it with duration or easing',
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

  describe('input that the types rule out, as a preset loaded from JSON can carry', () => {
    type Shatter = Parameters<typeof shatter>[0];
    type Slide = Parameters<typeof slide>[0];
    type Emerge = Parameters<typeof emerge>[0];
    type Fade = Parameters<typeof fade>[0];
    const parsed = <T>(json: string): T => JSON.parse(json) as T;

    test('a null where an object belongs names the field', () => {
      const object = (field: string) => `shatter: ${field} must be an object, got null`;
      const origin = (field: string) =>
        `shatter: ${field} must be 'center', 'press' or { x, y }, got null`;
      const shatterMessage = (json: string) => messageOf(() => shatter(parsed<Shatter>(json)));

      expect(shatterMessage('{"fragment":null}')).toBe(object('fragment'));
      expect(shatterMessage('{"fragment":{"anisotropy":null}}')).toBe(
        object('fragment.anisotropy'),
      );
      expect(shatterMessage('{"fragment":{"focus":null}}')).toBe(origin('fragment.focus'));
      expect(shatterMessage('{"forces":null}')).toBe('shatter: forces must be an array, got null');
      expect(shatterMessage('{"forces":[{},null]}')).toBe(object('forces[1]'));
      expect(shatterMessage('{"forces":[{"origin":null}]}')).toBe(origin('forces[0].origin'));
      expect(shatterMessage('{"release":null}')).toBe(object('release'));
      expect(shatterMessage('{"physics":null}')).toBe(object('physics'));
      expect(shatterMessage('{"life":null}')).toBe(object('life'));
      expect(shatterMessage('{"life":{"opacity":null}}')).toBe(
        'shatter: life.opacity must be an array of 2 numbers, got null',
      );
      expect(shatterMessage('{"life":{"scale":null}}')).toBe(
        'shatter: life.scale must be an array of 2 numbers, got null',
      );
      expect(shatterMessage('{"fallback":null}')).toBe(
        'shatter: fallback must be a live preset, got null',
      );
      expect(messageOf(() => disintegrate(parsed<Shatter>('{"physics":null}')))).toBe(
        'disintegrate: physics must be an object, got null',
      );
      expect(messageOf(() => slide(parsed<Slide>('{"alignOrigin":null}')))).toBe(
        'slide: alignOrigin must be an object, got null',
      );
      expect(messageOf(() => slide(parsed<Slide>('{"from":{"angle":null,"distance":4}}')))).toBe(
        'slide: from.angle must be a finite number, got null',
      );
      expect(messageOf(() => emerge(parsed<Emerge>('{"shadow":null}')))).toBe(
        'emerge: shadow must be an object, got null',
      );
      expect(messageOf(() => fade(parsed<Fade>('{"spring":null}')))).toBe(
        'fade: spring must be an object, got null',
      );
    });

    test('any other non-object where an object belongs names the field too', () => {
      const shatterMessage = (json: string) => messageOf(() => shatter(parsed<Shatter>(json)));

      expect(shatterMessage('{"physics":7}')).toBe('shatter: physics must be an object, got 7');
      expect(shatterMessage('{"release":[]}')).toBe(
        'shatter: release must be an object, got an array of 0',
      );
      expect(shatterMessage('{"forces":{}}')).toBe(
        'shatter: forces must be an array, got an object',
      );
      expect(shatterMessage('{"fragment":{"focus":3}}')).toBe(
        "shatter: fragment.focus must be 'center', 'press' or { x, y }, got 3",
      );
      expect(shatterMessage('{"life":{"opacity":[1,0,0]}}')).toBe(
        'shatter: life.opacity must be an array of 2 numbers, got an array of 3',
      );
      expect(shatterMessage('{"life":{"scale":1}}')).toBe(
        'shatter: life.scale must be an array of 2 numbers, got 1',
      );
      expect(messageOf(() => slide(parsed<Slide>('{"from":5}')))).toBe(
        'slide: from must be an edge, { angle, distance } or { x, y }, got 5',
      );
    });

    test('a null that is a documented value still passes', () => {
      expect(emerge({ sheen: null }).sheen).toBeNull();
      expect(slide({ path: null }).path).toBeNull();
      expect(shatter({ fragment: { subdivide: null } }).fragment.subdivide).toBeNull();
      expect(shatter(parsed<Shatter>('{"fragment":{"subdivide":null},"forces":[]}'))).toEqual({
        ...SHATTER_DEFAULTS,
        forces: [],
      });
    });
  });

  test('fragment presets reject duration, easing and spring', () => {
    const unused = (name: string, field: string) =>
      `${name}: ${field} is not used; the run length comes from release and life`;
    // @ts-expect-error a fragment preset takes no duration
    expect(messageOf(() => shatter({ duration: 0.5 }))).toBe(unused('shatter', 'duration'));
    // @ts-expect-error a fragment preset takes no easing
    expect(messageOf(() => shatter({ easing: 'linear' }))).toBe(unused('shatter', 'easing'));
    // @ts-expect-error a fragment preset takes no spring
    expect(messageOf(() => shatter({ spring: { duration: 0.4 } }))).toBe(
      unused('shatter', 'spring'),
    );
    // @ts-expect-error a fragment preset takes no duration
    expect(messageOf(() => disintegrate({ duration: 0 }))).toBe(unused('disintegrate', 'duration'));
    // @ts-expect-error a fragment preset takes no easing
    expect(messageOf(() => disintegrate({ easing: 'linear' }))).toBe(
      unused('disintegrate', 'easing'),
    );
    // @ts-expect-error a fragment preset takes no spring
    expect(messageOf(() => disintegrate({ spring: { duration: 0.4 } }))).toBe(
      unused('disintegrate', 'spring'),
    );
  });

  test('fragment presets still take delay, reduceMotion and fallback', () => {
    const fallback = fade();
    const p = shatter({ delay: 0.2, reduceMotion: 'always', fallback });
    expect(p.delay).toBe(0.2);
    expect(p.reduceMotion).toBe('always');
    expect(p.fallback).toBe(fallback);
    expect(disintegrate({ delay: 0.2 }).delay).toBe(0.2);
  });

  test('a count above maxFragments is not an error; both values are kept', () => {
    const p = shatter({ fragment: { count: 300 }, maxFragments: 10 });
    expect(p.fragment.count).toBe(300);
    expect(p.maxFragments).toBe(10);
    const budgeted = shatter({ maxFragments: 20 });
    expect(budgeted.fragment.count).toBe(40);
    expect(budgeted.maxFragments).toBe(20);
    const grains = disintegrate({ fragment: { pattern: 'grid', count: 3000 }, maxFragments: 100 });
    expect(grains.fragment.count).toBe(3000);
    expect(grains.maxFragments).toBe(100);
  });

  test('boundary values pass', () => {
    expect(fade({ opacity: 1 }).opacity).toBe(1);
    expect(shatter({ fragment: { count: 2 } }).fragment.count).toBe(2);
    expect(shatter({ fragment: { count: 300 } }).fragment.count).toBe(300);
    expect(disintegrate({ fragment: { cell: 1 } }).fragment.cell).toBe(1);
    expect(disintegrate({ fragment: { pattern: 'grid', count: 3000 } }).fragment.count).toBe(3000);
    expect(shatter({ forces: [{ strength: -400 }] }).forces[0]?.strength).toBe(-400);
    expect(slide({ start: -0.2, end: 1.3 }).end).toBe(1.3);
    expect(flip({ angle: 180 }).angle).toBe(180);
    expect(flip({ angle: -180 }).angle).toBe(-180);
    expect(flip({ angle: 0 }).angle).toBe(0);
    expect(flip({ perspective: 100 }).perspective).toBe(100);
    expect(flip({ origin: { x: -0.5, y: 2 } }).origin).toEqual({ x: -0.5, y: 2 });
    expect(flip({ origin: 'press', axis: 'x', fadeAtEdge: false })).toMatchObject({
      origin: 'press',
      axis: 'x',
      fadeAtEdge: false,
    });
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

  test('a flip is live', () => {
    const live: LivePreset = flip();
    expect(isSnapshotPreset(live)).toBe(false);
  });
});

describe('liveFallbackOf', () => {
  test('defaults to a short fade', () => {
    expect(liveFallbackOf(shatter())).toEqual(fade({ opacity: 0, duration: 0.15 }));
    expect(liveFallbackOf(slide())).toEqual(fade({ opacity: 0, duration: 0.15 }));
    expect(liveFallbackOf(flip())).toEqual(fade({ opacity: 0, duration: 0.15 }));
    expect(Object.isFrozen(liveFallbackOf(shatter()))).toBe(true);
  });

  test('returns the given fallback itself', () => {
    const fallback = slide();
    expect(liveFallbackOf(shatter({ fallback }))).toBe(fallback);
    const pressFallback = fade({ opacity: 0.5 });
    expect(liveFallbackOf(press({ fallback: pressFallback }))).toBe(pressFallback);
  });

  test('a press holds its pose at once instead of fading the element out', () => {
    const p = press({ scale: 0.9, opacity: 0.8 });
    const f = liveFallbackOf(p);
    expect(f).toEqual(press({ scale: 0.9, opacity: 0.8, duration: 0 }));
    expect(isDeepFrozen(f)).toBe(true);
    expect(liveFallbackOf(p)).toBe(f);
    expect(liveFallbackOf(press({ spring: { duration: 0.3, bounce: 0.2 } }))).toEqual(
      press({ duration: 0 }),
    );
  });

  test('a fade is already calm, so it stands in for itself', () => {
    const f = fade({ opacity: 0.4, duration: 0.6 });
    expect(liveFallbackOf(f)).toBe(f);
  });

  test('a default or live emerge is a LivePreset; a shader emerge is not', () => {
    const live: LivePreset = emerge();
    const explicit: LivePreset = emerge({ variant: 'live' });
    // @ts-expect-error a shader emerge is a snapshot preset
    const shader: LivePreset = emerge({ variant: 'shader' });
    expect(liveFallbackOf(slide({ fallback: emerge() }))).toEqual(live);
    expect(isSnapshotPreset(explicit)).toBe(false);
    expect(isSnapshotPreset(shader)).toBe(true);
  });
});

describe('presetDuration', () => {
  test('duration plus delay', () => {
    expect(presetDuration(fade({ duration: 0.2, delay: 0.1 }))).toBeCloseTo(0.3, 12);
    expect(presetDuration(fade())).toBe(0.25);
    expect(presetDuration(dust())).toBe(1.2);
  });

  test('a literal without a duration lasts the default of its kind, like the factory', () => {
    expect(presetDuration({ kind: 'fade', opacity: 0 })).toBe(presetDuration(fade()));
    expect(presetDuration({ kind: 'fade', opacity: 0 })).toBe(0.25);
    expect(presetDuration({ ...slide(), duration: undefined })).toBe(0.35);
    expect(presetDuration({ kind: 'press', scale: 0.9, opacity: 1, brightness: 1 })).toBe(0.12);
    expect(presetDuration({ ...emerge(), duration: undefined })).toBe(0.45);
    expect(presetDuration({ ...flip(), duration: undefined })).toBe(0.45);
    expect(presetDuration(flip({ delay: 0.1 }))).toBeCloseTo(0.55, 12);
    expect(presetDuration({ ...dust(), duration: undefined })).toBe(1.2);
    expect(presetDuration({ kind: 'fade', opacity: 0, delay: 0.5 })).toBe(0.75);
    expect(presetDuration({ kind: 'fade', opacity: 0, duration: 0 })).toBe(0);
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
