/**
 * Component definition and factory.
 *
 * Components are plain data objects. Each component type gets a unique
 * bit for archetype-based query matching.
 */

/** A unique component definition. */
export interface ComponentDef<T> {
  /** Internal unique ID (auto-assigned). */
  readonly id: number;
  /** Bitmask for this component (1 << id). */
  readonly bit: number;
  /** Component name for debugging. */
  readonly name: string;
  /** Create a new instance with default values. */
  create(): T;
}

let nextComponentId = 0;

/**
 * Define a new component type.
 *
 * @param name Debug name for the component.
 * @param defaults Factory function returning default values, or undefined for tag components.
 */
export function defineComponent<T = undefined>(name: string, defaults?: () => T): ComponentDef<T> {
  const id = nextComponentId++;
  if (id >= 32) {
    throw new Error(`Maximum 32 component types exceeded (defining "${name}")`);
  }
  return {
    id,
    bit: 1 << id,
    name,
    create: defaults ?? (() => undefined as T),
  };
}

/**
 * Reset the component ID counter. Only for testing.
 * @internal
 */
export function _resetComponentIds(): void {
  nextComponentId = 0;
}
