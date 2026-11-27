import { describe, expect, test } from 'bun:test';
import { generateFracture } from '../../src/core/fracture/generate';
import { FRAG_STRIDE, PHYS_LEN, REVERSE_MODE, TOTAL } from '../../src/core/motion/layout';
import { disintegrate, dust, emerge, presetDuration, shatter } from '../../src/core/presets';
import {
  createFragmentRun,
  fragmentMesh,
  grainCells,
  isFragmentPreset,
} from '../../src/fx/fragments';

describe('isFragmentPreset', () => {
  test('is true for shatter and disintegrate only', () => {
    expect(isFragmentPreset(shatter())).toBe(true);
    expect(isFragmentPreset(disintegrate())).toBe(true);
    expect(isFragmentPreset(dust())).toBe(false);
    expect(isFragmentPreset(emerge({ variant: 'shader' }))).toBe(false);
  });
});

describe('fragmentMesh', () => {
  test('without a press point, a press focus is the centre', () => {
    const preset = shatter();
    const mesh = fragmentMesh(preset, 100, 40, null, 1);
    expect(mesh.vertices).toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('breaks around the press point when the focus is the press', () => {
    const preset = shatter();
    const mesh = fragmentMesh(preset, 100, 40, { x: 25, y: 30 }, 1);
    const around = generateFracture({ ...preset.fragment, focus: { x: 0.25, y: 0.75 } }, 100, 40);
    expect(mesh.vertices).toEqual(around.vertices);
    expect(mesh.vertices).not.toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('a focus that is not the press ignores the press point', () => {
    const preset = shatter({ fragment: { focus: { x: 0.1, y: 0.9 } } });
    const mesh = fragmentMesh(preset, 100, 40, { x: 25, y: 30 }, 1);
    expect(mesh.vertices).toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('asks for no more than maxFragments pieces', () => {
    for (const pattern of ['radial-glass', 'triangles', 'jittered-grid', 'grid'] as const) {
      // Radial glass has 8 pieces at the least, whatever the count.
      for (const maxFragments of [8, 13, 20]) {
        const preset = shatter({ fragment: { pattern, count: 40 }, maxFragments });
        const mesh = fragmentMesh(preset, 100, 40, null, 1);
        expect(mesh.count).toBeGreaterThan(0);
        expect(mesh.count).toBeLessThanOrEqual(maxFragments);
      }
    }
  });

  test('gives the same mesh for the same run, from its cache', () => {
    const preset = shatter();
    expect(fragmentMesh(preset, 100, 40, null, 1)).toBe(fragmentMesh(preset, 100, 40, null, 1));
  });

  test('only cells read the pixel ratio', () => {
    for (const pattern of ['radial-glass', 'triangles', 'jittered-grid', 'grid'] as const) {
      const preset = shatter({ fragment: { pattern } });
      expect(fragmentMesh(preset, 100, 40, null, 3)).toBe(fragmentMesh(preset, 100, 40, null, 1));
    }
  });

  test('cells are cell pixels of the capture', () => {
    const preset = disintegrate();
    expect(preset.fragment.cell).toBe(4);
    // 100 by 40 layout pixels at 2x is 200 by 80 image pixels: 50 by 20 cells of 4.
    const mesh = fragmentMesh(preset, 100, 40, null, 2);
    expect(mesh.count).toBe(1000);
    expect(mesh.rectangular).toBe(true);
    expect(mesh.vertices).toEqual(generateFracture(preset.fragment, 200, 80).vertices);
    expect(fragmentMesh(preset, 100, 40, null, 1).count).toBe(250);
  });

  test('a 360x64 element at 3x with cell 4 has at most 3,000 cells: the cell grows to 9', () => {
    const preset = disintegrate();
    expect(preset.maxFragments).toBe(3000);
    const mesh = fragmentMesh(preset, 360, 64, null, 3);
    expect(mesh.count).toBe(120 * 22);
    expect(mesh.vertices).toEqual(
      generateFracture({ ...preset.fragment, cell: 9 }, 1080, 192).vertices,
    );
  });

  test('cells grow until there are no more than maxFragments', () => {
    for (const maxFragments of [1, 7, 500, 2999]) {
      const mesh = fragmentMesh(disintegrate({ maxFragments }), 360, 64, null, 3);
      expect(mesh.count).toBeGreaterThan(0);
      expect(mesh.count).toBeLessThanOrEqual(maxFragments);
    }
  });
});

describe('grainCells', () => {
  const rect = { x: 10, y: 20, width: 100, height: 40 };
  const image = { width: 232, height: 112, pixelRatio: 2, padding: 8, handle: null };

  test('each cell is its rect of the capture, the padding included, and turns about its centre', () => {
    const mesh = fragmentMesh(disintegrate(), rect.width, rect.height, null, image.pixelRatio);
    const { rects, pivots } = grainCells(mesh, rect, image);

    expect(rects).toHaveLength(mesh.count * 4);
    expect(pivots).toHaveLength(mesh.count * 2);
    // Row by row, 50 to a row: the first cell, and the second of the second row.
    expect([...rects.subarray(0, 4)]).toEqual([16, 16, 4, 4]);
    for (const [k, value] of [20, 20, 4, 4].entries()) {
      expect(rects[51 * 4 + k]).toBeCloseTo(value, 3);
    }
    for (let i = 0; i < mesh.count; i++) {
      expect(pivots[i * 2]).toBeCloseTo(2, 3);
      expect(pivots[i * 2 + 1]).toBeCloseTo(2, 3);
    }
  });

  test('a gap shrinks the cell cut from the capture, not only where it is drawn', () => {
    const preset = shatter({ fragment: { pattern: 'grid', count: 4, gap: 2 } });
    const mesh = fragmentMesh(preset, rect.width, rect.height, null, image.pixelRatio);
    const { rects } = grainCells(mesh, rect, image);

    for (let i = 0; i < mesh.count; i++) {
      const width = (mesh.bounds[i * 4 + 2]! - mesh.bounds[i * 4]!) * rect.width;
      expect(rects[i * 4 + 2]).toBeCloseTo(width * image.pixelRatio, 3);
      expect(rects[i * 4]).toBeCloseTo((8 + mesh.bounds[i * 4]! * rect.width) * 2, 3);
    }
  });
});

describe('createFragmentRun', () => {
  const preset = shatter({ delay: 0.25 });
  const mesh = fragmentMesh(preset, 100, 40, null, 1);

  test('holds a state row per piece and the physics block', () => {
    const run = createFragmentRun(preset, mesh, 100, 40, -1, null);
    expect(run.mesh).toBe(mesh);
    expect(run.state).toHaveLength(mesh.count * FRAG_STRIDE);
    expect(run.phys).toHaveLength(PHYS_LEN);
  });

  test('lasts the preset duration, the delay included', () => {
    const run = createFragmentRun(preset, mesh, 100, 40, -1, null);
    expect(run.delay).toBe(0.25);
    expect(run.duration).toBeCloseTo(presetDuration(preset), 6);
    expect(run.duration - run.delay).toBeCloseTo(run.phys[TOTAL]!, 6);
  });

  test('an exit plays forward, and an enter plays the reverse mode of the preset', () => {
    expect(createFragmentRun(preset, mesh, 100, 40, -1, null).phys[REVERSE_MODE]).toBe(0);
    const modes = { rewind: 1, home: 2, 'spring-home': 3 } as const;
    for (const reverse of ['rewind', 'home', 'spring-home'] as const) {
      const p = shatter({ reverse });
      expect(createFragmentRun(p, mesh, 100, 40, 1, null).phys[REVERSE_MODE]).toBe(modes[reverse]);
      expect(createFragmentRun(p, mesh, 100, 40, -1, null).phys[REVERSE_MODE]).toBe(0);
    }
  });
});
