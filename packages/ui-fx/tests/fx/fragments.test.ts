import { describe, expect, test } from 'bun:test';
import { generateFracture } from '../../src/core/fracture/generate';
import { FRAG_STRIDE, PHYS_LEN, REVERSE_MODE, TOTAL } from '../../src/core/motion/layout';
import { disintegrate, dust, emerge, presetDuration, shatter } from '../../src/core/presets';
import { createFragmentRun, fragmentMesh, isFragmentPreset } from '../../src/fx/fragments';

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
    const mesh = fragmentMesh(preset, 100, 40, null);
    expect(mesh.vertices).toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('breaks around the press point when the focus is the press', () => {
    const preset = shatter();
    const mesh = fragmentMesh(preset, 100, 40, { x: 25, y: 30 });
    const around = generateFracture({ ...preset.fragment, focus: { x: 0.25, y: 0.75 } }, 100, 40);
    expect(mesh.vertices).toEqual(around.vertices);
    expect(mesh.vertices).not.toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('a focus that is not the press ignores the press point', () => {
    const preset = shatter({ fragment: { focus: { x: 0.1, y: 0.9 } } });
    const mesh = fragmentMesh(preset, 100, 40, { x: 25, y: 30 });
    expect(mesh.vertices).toEqual(generateFracture(preset.fragment, 100, 40).vertices);
  });

  test('asks for no more than maxFragments pieces', () => {
    for (const pattern of ['radial-glass', 'triangles', 'jittered-grid', 'grid'] as const) {
      // Radial glass has 8 pieces at the least, whatever the count.
      for (const maxFragments of [8, 13, 20]) {
        const preset = shatter({ fragment: { pattern, count: 40 }, maxFragments });
        const mesh = fragmentMesh(preset, 100, 40, null);
        expect(mesh.count).toBeGreaterThan(0);
        expect(mesh.count).toBeLessThanOrEqual(maxFragments);
      }
    }
  });

  test('gives the same mesh for the same run, from its cache', () => {
    const preset = shatter();
    expect(fragmentMesh(preset, 100, 40, null)).toBe(fragmentMesh(preset, 100, 40, null));
  });
});

describe('createFragmentRun', () => {
  const preset = shatter({ delay: 0.25 });
  const mesh = fragmentMesh(preset, 100, 40, null);

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
