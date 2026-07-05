import type { ComponentDef, Query, World } from '@flare-engine/ecs';

// One singleton Query per (world, component), memoized so repeat serializeScene
// calls reuse them instead of registering a fresh (leaked) query each call.
// Queries auto-update, so reuse always reflects current world state. Bounded: at
// most one query per distinct component per world, all released when the world is
// garbage-collected (the WeakMap holds no strong ref beyond the world's lifetime).
const singletonQueries = new WeakMap<World, Map<number, Query>>();

function singletonQuery(world: World, def: ComponentDef<unknown>): Query {
  let byComponent = singletonQueries.get(world);
  if (byComponent === undefined) {
    byComponent = new Map();
    singletonQueries.set(world, byComponent);
  }
  let q = byComponent.get(def.id);
  if (q === undefined) {
    q = world.query(def);
    byComponent.set(def.id, q);
  }
  return q;
}

/**
 * A single entity in a snapshot. Component names come from `ComponentDef.name`.
 */
export interface SceneSnapshotEntity {
  id: number;
  components: Record<string, unknown>;
}

export interface SceneSnapshot {
  entities: SceneSnapshotEntity[];
}

/**
 * Serialize every entity that has at least one of the supplied components into
 * a stable, deterministic snapshot. Entities are sorted by id; component keys
 * are inserted in the order the components are passed.
 */
export function serializeScene(
  world: World,
  components: readonly ComponentDef<unknown>[],
): SceneSnapshot {
  // Collect every entity that has ANY of the supplied components (union of the
  // per-component queries). A separate ALL query would be redundant — anything
  // matching ALL already matches each singleton.
  const ids = new Set<number>();
  for (const def of components) {
    for (const id of singletonQuery(world, def)) ids.add(id);
  }

  const sortedIds = [...ids].sort((a, b) => a - b);
  const entities: SceneSnapshotEntity[] = [];
  for (const id of sortedIds) {
    const comps: Record<string, unknown> = {};
    for (const def of components) {
      if (world.has(id, def)) comps[def.name] = world.get(id, def);
    }
    entities.push({ id, components: comps });
  }
  return { entities };
}

/**
 * Deep-equal comparison good enough for snapshot assertions. Compares plain
 * objects, arrays, and primitives — no Date, Map, Set, or cyclic graphs.
 */
export function snapshotsEqual(a: SceneSnapshot, b: SceneSnapshot): boolean {
  return deepEqual(a, b);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const ak = Object.keys(ao);
    const bk = Object.keys(bo);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.hasOwn(bo, k)) return false;
      if (!deepEqual(ao[k], bo[k])) return false;
    }
    return true;
  }
  return false;
}
