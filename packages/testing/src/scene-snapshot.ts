import type { ComponentDef, World } from '@flare-engine/ecs';

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
  const ids = new Set<number>();
  const q = world.query(...components);
  for (const id of q) ids.add(id);
  // Also include entities that have any subset — the query above requires ALL.
  // For snapshots we want "any of". Iterate each component individually.
  for (const def of components) {
    const singletonQ = world.query(def);
    for (const id of singletonQ) ids.add(id);
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
