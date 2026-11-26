import { expect, test } from 'bun:test';
import { createAtlasPool } from '../../src/web/atlas';
import { makeMockKit } from '../support/mock-kit';

test('a pool holds four floats of source rect and of transform, and one colour, per sprite', () => {
  const pool = createAtlasPool(makeMockKit().kit, 64);

  expect(pool.srcs).toBeInstanceOf(Float32Array);
  expect(pool.xforms).toBeInstanceOf(Float32Array);
  expect(pool.colors).toBeInstanceOf(Uint32Array);
  expect(pool.srcs.length).toBe(pool.colors.length * 4);
  expect(pool.xforms.length).toBe(pool.colors.length * 4);
  expect(pool.colors.length).toBeGreaterThanOrEqual(64);
});

test('a new pool draws nothing: every sprite is at zero scale and untinted', () => {
  const pool = createAtlasPool(makeMockKit().kit, 64);

  expect(pool.xforms.every((value) => value === 0)).toBe(true);
  expect(pool.colors.every((value) => value === 0xffffffff)).toBe(true);
});

test('capacities of one tier share one pool, so a run allocates nothing after the first', () => {
  const { kit } = makeMockKit();
  const first = createAtlasPool(kit, 300);

  expect(createAtlasPool(kit, 300)).toBe(first);
  expect(createAtlasPool(kit, 257)).toBe(first);
  expect(createAtlasPool(kit, 512)).toBe(first);
  expect(first.colors.length).toBe(512);
});

test('a larger capacity gets a larger tier, and the smaller one is kept', () => {
  const { kit } = makeMockKit();
  const small = createAtlasPool(kit, 300);
  const large = createAtlasPool(kit, 3000);

  expect(large).not.toBe(small);
  expect(large.colors.length).toBe(4096);
  expect(createAtlasPool(kit, 300)).toBe(small);
});

test('the smallest tier holds 64 sprites', () => {
  expect(createAtlasPool(makeMockKit().kit, 1).colors.length).toBe(64);
});

test('each kit has its own pools', () => {
  expect(createAtlasPool(makeMockKit().kit, 64)).not.toBe(createAtlasPool(makeMockKit().kit, 64));
});

test('a capacity that is not a positive integer throws', () => {
  const { kit } = makeMockKit();

  expect(() => createAtlasPool(kit, 0)).toThrow(RangeError);
  expect(() => createAtlasPool(kit, 1.5)).toThrow(RangeError);
  expect(() => createAtlasPool(kit, Number.NaN)).toThrow(RangeError);
});
