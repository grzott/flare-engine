import { describe, expect, test } from 'bun:test';
import {
  applyRemap,
  createIdentityRemap,
  loadRemap,
  type RemapStore,
  type RemapTable,
  saveRemap,
} from '../src/remap.js';

function createMemoryStore(): RemapStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key) ?? null;
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}

describe('remap', () => {
  test('identity table leaves a snapshot unchanged', () => {
    const table = createIdentityRemap(4, 2);
    const snap = {
      id: 'x',
      index: 0,
      timestamp: 0,
      buttons: [
        { pressed: true, value: 1 },
        { pressed: false, value: 0 },
        { pressed: true, value: 0.5 },
        { pressed: false, value: 0 },
      ],
      axes: [0.5, -0.25],
    };
    const out = applyRemap(snap, table);
    expect(out.buttons).toEqual(snap.buttons);
    expect(out.axes).toEqual(snap.axes);
  });

  test('swapping buttons via the table reorders the output', () => {
    const table: RemapTable = {
      buttons: [1, 0], // logical 0 ← physical 1
      axes: [{ index: 0, invert: false, scale: 1 }],
    };
    const snap = {
      id: 'x',
      index: 0,
      timestamp: 0,
      buttons: [
        { pressed: false, value: 0 },
        { pressed: true, value: 1 },
      ],
      axes: [0.5],
    };
    const out = applyRemap(snap, table);
    expect(out.buttons[0]?.pressed).toBe(true);
    expect(out.buttons[1]?.pressed).toBe(false);
  });

  test('axis invert and scale apply correctly', () => {
    const table: RemapTable = {
      buttons: [],
      axes: [{ index: 0, invert: true, scale: 0.5 }],
    };
    const snap = {
      id: 'x',
      index: 0,
      timestamp: 0,
      buttons: [],
      axes: [1],
    };
    const out = applyRemap(snap, table);
    expect(out.axes[0]).toBe(-0.5);
  });

  test('missing physical button reads as released', () => {
    const table: RemapTable = {
      buttons: [5],
      axes: [],
    };
    const snap = { id: 'x', index: 0, timestamp: 0, buttons: [], axes: [] };
    const out = applyRemap(snap, table);
    expect(out.buttons[0]).toEqual({ pressed: false, value: 0 });
  });

  test('save and load round-trip through a storage adapter', async () => {
    const store = createMemoryStore();
    const table = createIdentityRemap(4, 2);
    await saveRemap(store, 'remap:pad0', table);
    const loaded = await loadRemap(store, 'remap:pad0');
    expect(loaded).toEqual(table);
  });

  test('loadRemap returns null when absent', async () => {
    const store = createMemoryStore();
    expect(await loadRemap(store, 'missing')).toBe(null);
  });

  test('loadRemap returns null on malformed payload', async () => {
    const store = createMemoryStore();
    await store.set('bad', 'not-json');
    expect(await loadRemap(store, 'bad')).toBe(null);

    await store.set('wrong-shape', JSON.stringify({ buttons: 'oops', axes: [] }));
    expect(await loadRemap(store, 'wrong-shape')).toBe(null);

    await store.set(
      'bad-axis',
      JSON.stringify({ buttons: [0, 1], axes: [{ index: 'zero', invert: false, scale: 1 }] }),
    );
    expect(await loadRemap(store, 'bad-axis')).toBe(null);
  });
});
