import type { ComponentDef } from './component.js';
import type { World } from './world.js';

/** A component entry in a prefab definition. */
interface PrefabEntry<T> {
  def: ComponentDef<T>;
  data?: T | (() => T);
}

/** A prefab factory that spawns entities with pre-defined components. */
export interface Prefab {
  readonly name: string;
  /** Spawn an entity with this prefab's components. */
  spawn(world: World, overrides?: Record<string, unknown>): number;
}

/**
 * Define a prefab — a template for spawning entities with a fixed set of components.
 *
 * @param name Debug name.
 * @param entries Array of [componentDef, data?] tuples.
 */
export function definePrefab(
  name: string,
  ...entries: [ComponentDef<unknown>, (unknown | (() => unknown))?][]
): Prefab {
  const components: PrefabEntry<unknown>[] = entries.map(([def, data]) => ({
    def,
    data,
  }));

  return {
    name,
    spawn(world: World): number {
      const entity = world.spawn();
      for (const entry of components) {
        const data =
          typeof entry.data === 'function' ? (entry.data as () => unknown)() : entry.data;
        world.add(entity, entry.def, data);
      }
      return entity;
    },
  };
}
