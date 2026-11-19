import { describe, expect, test } from 'bun:test';
import { generateFracture } from '../../../src/core/fracture/generate';
import { packShardsInto } from '../../../src/core/fracture/pack';
import type { FractureMesh, ShardPacking } from '../../../src/core/fracture/types';
import { fragmentSpec } from '../../support/fracture';

const packingFor = (mesh: FractureMesh): ShardPacking => ({
  atlasW: 0,
  atlasH: 0,
  scale: 0,
  rects: new Float32Array(mesh.count * 4),
});

/** Every rect is whole pixels, inside the atlas by `padding`, and `padding` clear of the others. */
const expectPacked = (mesh: FractureMesh, packing: ShardPacking, padding: number): void => {
  const { rects, atlasW, atlasH } = packing;
  for (let i = 0; i < mesh.count; i++) {
    const x = rects[i * 4]!;
    const y = rects[i * 4 + 1]!;
    const w = rects[i * 4 + 2]!;
    const h = rects[i * 4 + 3]!;
    for (const value of [x, y, w, h]) expect(Number.isInteger(value)).toBe(true);
    expect(w).toBeGreaterThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(1);
    expect(x).toBeGreaterThanOrEqual(padding);
    expect(y).toBeGreaterThanOrEqual(padding);
    expect(x + w + padding).toBeLessThanOrEqual(atlasW);
    expect(y + h + padding).toBeLessThanOrEqual(atlasH);
  }
  for (let i = 0; i < mesh.count; i++) {
    for (let j = i + 1; j < mesh.count; j++) {
      const apart =
        rects[i * 4]! + rects[i * 4 + 2]! + padding <= rects[j * 4]! ||
        rects[j * 4]! + rects[j * 4 + 2]! + padding <= rects[i * 4]! ||
        rects[i * 4 + 1]! + rects[i * 4 + 3]! + padding <= rects[j * 4 + 1]! ||
        rects[j * 4 + 1]! + rects[j * 4 + 3]! + padding <= rects[i * 4 + 1]!;
      if (!apart) throw new Error(`rects ${i} and ${j} overlap or touch within the padding`);
    }
  }
};

/** Every rect holds its piece's bounding box at the packing's scale. */
const expectRoomy = (mesh: FractureMesh, packing: ShardPacking, w: number, h: number): void => {
  for (let i = 0; i < mesh.count; i++) {
    const needW = (mesh.bounds[i * 4 + 2]! - mesh.bounds[i * 4]!) * w * packing.scale;
    const needH = (mesh.bounds[i * 4 + 3]! - mesh.bounds[i * 4 + 1]!) * h * packing.scale;
    expect(packing.rects[i * 4 + 2]!).toBeGreaterThan(needW - 0.01);
    expect(packing.rects[i * 4 + 3]!).toBeGreaterThan(needH - 0.01);
    expect(packing.rects[i * 4 + 2]!).toBeLessThan(needW + 1.01);
    expect(packing.rects[i * 4 + 3]!).toBeLessThan(needH + 1.01);
  }
};

describe('packShardsInto', () => {
  for (const pattern of ['grid', 'jittered-grid', 'triangles', 'radial-glass'] as const) {
    test(`${pattern}: rects never overlap and stay inside the atlas`, () => {
      for (const seed of [1, 2, 3]) {
        const mesh = generateFracture(fragmentSpec({ pattern, count: 40, seed }), 320, 200);
        const packing = packingFor(mesh);
        expect(packShardsInto(mesh, 320, 200, 2, 2048, packing)).toBe(packing);
        expect(packing.scale).toBe(1);
        expectPacked(mesh, packing, 2);
        expectRoomy(mesh, packing, 320, 200);
      }
    });
  }

  test('padding and maxAtlas default to 2 and 2048', () => {
    const mesh = generateFracture(fragmentSpec({ count: 40 }), 320, 200);
    const explicit = packShardsInto(mesh, 320, 200, 2, 2048, packingFor(mesh));
    const defaulted = packShardsInto(mesh, 320, 200, undefined, undefined, packingFor(mesh));
    expect(defaulted).toEqual(explicit);
  });

  test('a 1080x1920 element with 300 shards is scaled down into a 2048 atlas', () => {
    const mesh = generateFracture(fragmentSpec({ count: 300 }), 1080, 1920);
    const packing = packShardsInto(mesh, 1080, 1920, 2, 2048, packingFor(mesh));
    expect(packing.scale).toBeLessThan(1);
    expect(packing.scale).toBeGreaterThan(0);
    expect(packing.atlasW).toBeLessThanOrEqual(2048);
    expect(packing.atlasH).toBeLessThanOrEqual(2048);
    expectPacked(mesh, packing, 2);
    expectRoomy(mesh, packing, 1080, 1920);
  });

  test('the scale halves until the atlas fits maxAtlas', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'grid', count: 16 }), 400, 400);
    const packing = packShardsInto(mesh, 400, 400, 2, 256, packingFor(mesh));
    expect(packing.scale).toBe(0.5);
    expect(packing.atlasW).toBeLessThanOrEqual(256);
    expect(packing.atlasH).toBeLessThanOrEqual(256);
    expectPacked(mesh, packing, 2);
  });

  test('packing again into the same out gives the same result', () => {
    const mesh = generateFracture(fragmentSpec({ count: 60 }), 500, 300);
    const packing = packingFor(mesh);
    packShardsInto(mesh, 500, 300, 2, 2048, packing);
    const first = { ...packing, rects: Array.from(packing.rects) };
    const rects = packing.rects;
    packShardsInto(mesh, 500, 300, 2, 2048, packing);
    expect(packing.rects).toBe(rects);
    expect({ ...packing, rects: Array.from(packing.rects) }).toEqual(first);
  });

  test('rejects a rects buffer shorter than 4 per piece', () => {
    const mesh = generateFracture(fragmentSpec({ count: 40 }), 320, 200);
    const short: ShardPacking = { atlasW: 0, atlasH: 0, scale: 0, rects: new Float32Array(8) };
    expect(() => packShardsInto(mesh, 320, 200, 2, 2048, short)).toThrow(RangeError);
  });

  test('rejects an atlas too small for the pieces at any scale', () => {
    const mesh = generateFracture(fragmentSpec({ pattern: 'grid', count: 100 }), 320, 200);
    expect(() => packShardsInto(mesh, 320, 200, 2, 16, packingFor(mesh))).toThrow(RangeError);
  });

  test('rejects a negative padding', () => {
    const mesh = generateFracture(fragmentSpec({ count: 40 }), 320, 200);
    expect(() => packShardsInto(mesh, 320, 200, -1, 2048, packingFor(mesh))).toThrow(RangeError);
  });
});
