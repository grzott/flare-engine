/**
 * Component definition and factory.
 *
 * Components are plain data objects. Each component type gets a unique
 * bit for archetype-based query matching.
 */

/** A unique component definition. */
export interface ComponentDef<T> {
  /**
   * Internal unique ID (auto-assigned).
   * @deprecated Removed in 0.5.0. A `World` no longer keys storage by it, and it comes from a
   * module-global counter, so it depends on import order and must never be persisted. Key by the
   * definition object itself instead (e.g. a `Map<ComponentDef<unknown>, …>`).
   */
  readonly id: number;
  /**
   * Bitmask for this component (1 << id).
   * @deprecated Removed in 0.5.0, which lifts the 32-type cap: `1 << id` wraps from the 33rd
   * definition on. A `World` no longer keys storage by it. Key by the definition object itself
   * instead (e.g. a `Map<ComponentDef<unknown>, …>`).
   */
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
 * @deprecated Removed in 0.5.0 together with the global counter it resets. Each `World` keys
 * storage by the definition object, so isolating storage between tests needs no reset.
 */
export function _resetComponentIds(): void {
  nextComponentId = 0;
}
