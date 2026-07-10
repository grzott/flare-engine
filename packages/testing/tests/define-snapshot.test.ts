import { describe, expect, it } from 'bun:test';
import { defineComponent, World } from '@flare-engine/ecs';
import { defineSnapshot } from '../src/define-snapshot.js';

const Health = defineComponent<{ hp: number }>('Health', () => ({ hp: 100 }));
const Name = defineComponent<{ label: string }>('Name', () => ({ label: '' }));
const Marker = defineComponent<Record<string, never>>('Marker', () => ({}));

describe('defineSnapshot', () => {
  it('single projector returns exactly matching entities', () => {
    const world = new World();
    const e1 = world.spawn();
    world.add(e1, Health, { hp: 80 });
    const e2 = world.spawn();
    world.add(e2, Name, { label: 'foo' });

    const snap = defineSnapshot({
      healthy: {
        query: [Health],
        project: (w, id) => w.get(id, Health)!.hp,
      },
    });

    const result = snap(world);
    expect(result.healthy).toEqual([80]);
  });

  it('ids are sorted for stability across calls', () => {
    const world = new World();
    const e1 = world.spawn();
    world.add(e1, Health, { hp: 10 });
    const e2 = world.spawn();
    world.add(e2, Health, { hp: 20 });
    const e3 = world.spawn();
    world.add(e3, Health, { hp: 30 });

    const snap = defineSnapshot({
      hps: {
        query: [Health],
        project: (w, id) => w.get(id, Health)!.hp,
      },
    });

    const r1 = snap(world);
    const r2 = snap(world);
    expect(r1.hps).toEqual(r2.hps);
    // Values in ascending entity-id order (ids were spawned 1, 2, 3)
    expect(r1.hps).toEqual([10, 20, 30]);
  });

  it('two projectors are independent — each queries its own component', () => {
    const world = new World();
    const e1 = world.spawn();
    world.add(e1, Health, { hp: 50 });
    const e2 = world.spawn();
    world.add(e2, Name, { label: 'hero' });

    const snap = defineSnapshot({
      hps: {
        query: [Health],
        project: (w, id) => w.get(id, Health)!.hp,
      },
      names: {
        query: [Name],
        project: (w, id) => w.get(id, Name)!.label,
      },
    });

    const result = snap(world);
    expect(result.hps).toEqual([50]);
    expect(result.names).toEqual(['hero']);
  });

  it('project receives the correct (world, id) — verified by reading a real component', () => {
    const world = new World();
    const e1 = world.spawn();
    world.add(e1, Health, { hp: 77 });

    const receivedIds: number[] = [];
    const snap = defineSnapshot({
      check: {
        query: [Health],
        project: (w, id) => {
          receivedIds.push(id);
          return w.get(id, Health)!.hp;
        },
      },
    });

    const result = snap(world);
    expect(receivedIds).toEqual([e1]);
    expect(result.check).toEqual([77]);
  });

  it('empty world returns empty arrays', () => {
    const world = new World();
    const snap = defineSnapshot({
      hps: {
        query: [Health],
        project: (w, id) => w.get(id, Health)!.hp,
      },
    });
    expect(snap(world).hps).toEqual([]);
  });

  it('multi-component query filters correctly', () => {
    const world = new World();
    const e1 = world.spawn();
    world.add(e1, Health, { hp: 40 });
    world.add(e1, Marker);
    const e2 = world.spawn();
    world.add(e2, Health, { hp: 60 });
    // e2 does NOT have Marker — should be excluded

    const snap = defineSnapshot({
      marked: {
        query: [Health, Marker],
        project: (w, id) => w.get(id, Health)!.hp,
      },
    });

    expect(snap(world).marked).toEqual([40]);
  });
});
