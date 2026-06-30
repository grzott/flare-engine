import { describe, expect, mock, test } from 'bun:test';

// Restore real @flare-engine/ecs before loading scene-snapshot.ts.
// The react/game-view.test.ts mock strips World to a class with no spawn().
type RealEcsModule = typeof import('@flare-engine/ecs');
const _realEcs = (await import('../../ecs/src/index.js')) as unknown as RealEcsModule;
mock.module('@flare-engine/ecs', () => ({ ..._realEcs }));

const { serializeScene, snapshotsEqual } = await import('../src/scene-snapshot.js');
// Do NOT destructure from `await import('@flare-engine/ecs')` — Bun's ESM
// live-binding cache keeps the export shape of the originally-cached mock
// (only { World, Position }) and silently drops exports absent from it.
const World = _realEcs.World;
const _resetComponentIds = _realEcs._resetComponentIds;
const defineComponent = _realEcs.defineComponent;

describe('serializeScene', () => {
  test('entities are sorted by id and include only present components', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const Vel = defineComponent<{ dx: number; dy: number }>('Vel', () => ({ dx: 0, dy: 0 }));

    const w = new World();
    const b = w.spawn();
    const a = w.spawn();
    w.add(a, Pos, { x: 1, y: 2 });
    w.add(b, Pos, { x: 3, y: 4 });
    w.add(b, Vel, { dx: 5, dy: 6 });

    const snap = serializeScene(w, [Pos, Vel]);
    expect(snap.entities.map((e) => e.id)).toEqual([b, a].sort((x, y) => x - y));
    const byId = new Map(snap.entities.map((e) => [e.id, e]));
    expect(byId.get(a)?.components).toEqual({ Pos: { x: 1, y: 2 } });
    expect(byId.get(b)?.components).toEqual({ Pos: { x: 3, y: 4 }, Vel: { dx: 5, dy: 6 } });
  });

  test('skips entities with none of the requested components', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const Tag = defineComponent<undefined>('Tag');

    const w = new World();
    const e = w.spawn();
    w.add(e, Tag);

    const snap = serializeScene(w, [Pos]);
    expect(snap.entities).toEqual([]);
  });

  test('is JSON-serializable', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const w = new World();
    const id = w.spawn();
    w.add(id, Pos, { x: 1, y: 2 });
    const snap = serializeScene(w, [Pos]);
    expect(() => JSON.stringify(snap)).not.toThrow();
  });
});

describe('snapshotsEqual', () => {
  test('deep equality matches identical snapshots', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const w1 = new World();
    const w2 = new World();
    for (const w of [w1, w2]) {
      const id = w.spawn();
      w.add(id, Pos, { x: 1, y: 2 });
    }
    expect(snapshotsEqual(serializeScene(w1, [Pos]), serializeScene(w2, [Pos]))).toBe(true);
  });

  test('detects value differences', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const w1 = new World();
    const w2 = new World();
    const a = w1.spawn();
    const b = w2.spawn();
    w1.add(a, Pos, { x: 1, y: 2 });
    w2.add(b, Pos, { x: 9, y: 2 });
    expect(snapshotsEqual(serializeScene(w1, [Pos]), serializeScene(w2, [Pos]))).toBe(false);
  });

  test('detects length differences', () => {
    _resetComponentIds();
    const Pos = defineComponent<{ x: number; y: number }>('Pos', () => ({ x: 0, y: 0 }));
    const w1 = new World();
    const w2 = new World();
    w1.add(w1.spawn(), Pos, { x: 1, y: 2 });
    expect(snapshotsEqual(serializeScene(w1, [Pos]), serializeScene(w2, [Pos]))).toBe(false);
  });
});
