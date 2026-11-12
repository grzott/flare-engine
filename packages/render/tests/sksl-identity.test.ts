import { describe, expect, test } from 'bun:test';
import * as shaders from '../src/shaders.js';
import * as snapshots from './fixtures/shaders-sksl.js';

const exported: Readonly<Record<string, string>> = shaders;
const pinned: Readonly<Record<string, string>> = snapshots;

describe('exported SkSL strings are byte-identical to the pinned copies', () => {
  const names = Object.keys(exported).filter((name) => name.endsWith('_SKSL'));

  test('every exported shader string has a pinned copy, and nothing else is pinned', () => {
    expect(names.length).toBe(9);
    expect(Object.keys(pinned).sort()).toEqual(names.map((name) => `${name}_SNAPSHOT`).sort());
  });

  for (const name of names) {
    test(name, () => {
      const snapshot = pinned[`${name}_SNAPSHOT`];
      expect(snapshot?.length).toBeGreaterThan(100);
      expect(exported[name]).toBe(snapshot);
    });
  }
});
