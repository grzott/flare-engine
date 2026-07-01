import type { ComponentDef, Query, World } from '@flare-engine/ecs';

export interface SnapshotProjector {
  readonly query: readonly ComponentDef<unknown>[];
  project(world: World, id: number): unknown;
}

export interface SnapshotSchema {
  readonly [key: string]: SnapshotProjector;
}

export function defineSnapshot<S extends SnapshotSchema>(
  schema: S,
): (world: World) => { readonly [K in keyof S]: readonly unknown[] } {
  // One Query[] per world; queries auto-update so reuse is correct.
  const cache = new WeakMap<World, Query[]>();
  const keys = Object.keys(schema);

  return (world: World) => {
    let queries = cache.get(world);
    if (queries === undefined) {
      queries = keys.map((key) => {
        const projector = schema[key]!;
        return world.query(...(projector.query as ComponentDef<unknown>[]));
      });
      cache.set(world, queries);
    }

    const result: Record<string, readonly unknown[]> = {};
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]!;
      const projector = schema[key]!;
      const q = queries[i]!;
      const ids: number[] = [];
      for (const id of q) {
        ids.push(id);
      }
      ids.sort((a, b) => a - b);
      result[key] = ids.map((id) => projector.project(world, id));
    }
    return result as { readonly [K in keyof S]: readonly unknown[] };
  };
}
