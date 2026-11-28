import { describe, expect, test } from 'bun:test';
import { directionInto } from '../../src/core/conventions';
import { dust } from '../../src/core/presets';
import {
  DUST_SKSL,
  DUST_UNIFORM_FLOATS,
  DUST_UNIFORM_SIZES,
  DUST_UNIFORMS,
  packDustUniformsInto,
} from '../../src/core/sksl';

/** The floats of the uniform `name` in a packed block. */
const uniformOf = (packed: Float32Array, name: (typeof DUST_UNIFORMS)[number]): number[] => {
  let o = 0;
  for (let i = 0; i < DUST_UNIFORMS.length; i++) {
    const size = DUST_UNIFORM_SIZES[i]!;
    if (DUST_UNIFORMS[i] === name) return [...packed.subarray(o, o + size)];
    o += size;
  }
  throw new Error(`there is no uniform ${name}`);
};

describe('DUST_UNIFORMS', () => {
  test('lists the uniforms in the order the shader declares them', () => {
    expect([...DUST_UNIFORMS]).toEqual([
      'u_progress',
      'u_dir',
      'u_softness',
      'u_noiseScale',
      'u_noiseAmount',
      'u_edgeWidth',
      'u_edgeColor',
      'u_size',
      'u_spread',
      'u_seed',
    ]);
    const declared = [...DUST_SKSL.matchAll(/uniform (?:float|float2|half4) (u_\w+);/g)].map(
      (match) => match[1],
    );
    expect(declared).toEqual([...DUST_UNIFORMS]);
  });

  test('the sizes are the float count of each declared type', () => {
    const floats: Record<string, number> = { float: 1, float2: 2, half4: 4 };
    const declared = [...DUST_SKSL.matchAll(/uniform (float|float2|half4) u_\w+;/g)].map(
      (match) => floats[match[1] ?? ''] ?? 0,
    );
    const sizes: number[] = [...DUST_UNIFORM_SIZES];
    expect(sizes).toEqual(declared);
    expect(DUST_UNIFORM_FLOATS).toBe(15);
    expect(DUST_UNIFORM_SIZES.reduce((sum, size) => sum + size, 0)).toBe(DUST_UNIFORM_FLOATS);
  });

  test('the shader takes the capture as its one child', () => {
    expect([...DUST_SKSL.matchAll(/uniform shader (\w+);/g)].map((match) => match[1])).toEqual([
      'image',
    ]);
  });
});

describe('packDustUniformsInto', () => {
  test('packs the uniforms in the DUST_UNIFORMS order, and returns out', () => {
    const preset = dust({
      sweepAngle: 90,
      softness: 0.2,
      noiseScale: 12,
      noiseAmount: 0.5,
      edgeWidth: 0.1,
      edgeColor: '#ff8000',
      spread: 32,
      seed: 7,
    });
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    expect(packDustUniformsInto(preset, 0.25, 100, 40, out)).toBe(out);

    const expected = [
      0.25, // u_progress
      1,
      0, // u_dir
      0.2, // u_softness
      12, // u_noiseScale
      0.5, // u_noiseAmount
      0.1, // u_edgeWidth
      1,
      128 / 255,
      0,
      1, // u_edgeColor
      100,
      40, // u_size
      32, // u_spread
      7, // u_seed
    ];
    expect(out).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) expect(out[i]).toBeCloseTo(expected[i]!, 6);
  });

  test('u_dir is directionInto(sweepAngle)', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    for (const sweepAngle of [0, 37, 90, 180, 225, -45]) {
      const dir = directionInto(sweepAngle, { x: 0, y: 0 });
      const [x, y] = uniformOf(packDustUniformsInto(dust({ sweepAngle }), 0, 10, 10, out), 'u_dir');
      expect(x).toBeCloseTo(dir.x, 6);
      expect(y).toBeCloseTo(dir.y, 6);
    }
  });

  test('reads the edge colour from every hex form', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    const colorOf = (edgeColor: string): number[] =>
      uniformOf(packDustUniformsInto(dust({ edgeColor }), 0, 10, 10, out), 'u_edgeColor');

    expect(colorOf('#ffffff')).toEqual([1, 1, 1, 1]);
    expect(colorOf('#000')).toEqual([0, 0, 0, 1]);
    expect(colorOf('#F00')).toEqual([1, 0, 0, 1]);
    expect(colorOf('#00ff0000')).toEqual([0, 1, 0, 0]);
    expect(colorOf('#00f0')).toEqual([0, 0, 1, 0]);
    expect(colorOf('#336699')[0]).toBeCloseTo(0x33 / 255, 6);
    expect(colorOf('#336699')[1]).toBeCloseTo(0x66 / 255, 6);
    expect(colorOf('#336699')[2]).toBeCloseTo(0x99 / 255, 6);
  });

  test('a colour that is not hex packs as white', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    for (const edgeColor of ['red', '#12', '#gggggg', 'rgb(0, 0, 0)', '']) {
      expect(
        uniformOf(packDustUniformsInto(dust({ edgeColor }), 0, 10, 10, out), 'u_edgeColor'),
      ).toEqual([1, 1, 1, 1]);
    }
  });

  test('keeps the smoothstep edges apart when softness or edgeWidth is 0', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    packDustUniformsInto(dust({ softness: 0, edgeWidth: 0 }), 0, 10, 10, out);
    expect(uniformOf(out, 'u_softness')[0]).toBeGreaterThan(0);
    expect(uniformOf(out, 'u_softness')[0]).toBeLessThan(1e-3);
    expect(uniformOf(out, 'u_edgeWidth')[0]).toBeGreaterThan(0);
    expect(uniformOf(out, 'u_edgeWidth')[0]).toBeLessThan(1e-3);
  });

  test('folds a large seed into a range a float keeps exact', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS);
    const seed = uniformOf(
      packDustUniformsInto(dust({ seed: 0xffffffff }), 0, 10, 10, out),
      'u_seed',
    )[0]!;
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(4096);
    expect(Number.isInteger(seed)).toBe(true);
    const other = uniformOf(
      packDustUniformsInto(dust({ seed: 0xfffffffe }), 0, 10, 10, out),
      'u_seed',
    )[0]!;
    expect(other).not.toBe(seed);
  });

  test('writes into the buffer it is given: nothing is allocated', () => {
    const out = new Float32Array(DUST_UNIFORM_FLOATS + 2).fill(9);
    packDustUniformsInto(dust(), 1, 10, 10, out);
    expect(out[0]).toBe(1);
    expect(out[DUST_UNIFORM_FLOATS]).toBe(9);
  });

  test('throws when out is too short', () => {
    expect(() => packDustUniformsInto(dust(), 0, 10, 10, new Float32Array(14))).toThrow(RangeError);
  });
});
