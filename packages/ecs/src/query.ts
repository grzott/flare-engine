import { Signal } from '@flare/events';
import type { ComponentDef } from './component.js';

/**
 * Query matches entities based on component archetypes.
 *
 * Uses bitmask matching: entity archetype & requiredMask === requiredMask
 * and entity archetype & excludedMask === 0.
 */
export class Query {
  /** Bitmask of required components. */
  readonly requiredMask: number;
  /** Bitmask of excluded components. */
  readonly excludedMask: number;

  /** Fires when an entity is added to this query's results. */
  readonly onEntityAdded = new Signal<number>();
  /** Fires when an entity is removed from this query's results. */
  readonly onEntityRemoved = new Signal<number>();

  /** Sorted array of matching entity IDs. */
  private entities: number[] = [];
  /** Set for O(1) membership check. */
  private entitySet = new Set<number>();

  constructor(requiredMask: number, excludedMask: number) {
    this.requiredMask = requiredMask;
    this.excludedMask = excludedMask;
  }

  /** Check if an archetype matches this query. */
  matches(archetype: number): boolean {
    return (
      (archetype & this.requiredMask) === this.requiredMask && (archetype & this.excludedMask) === 0
    );
  }

  /** @internal — called by World when an entity's archetype changes. */
  _check(entityId: number, archetype: number): void {
    const isMatch = this.matches(archetype);
    const wasMatch = this.entitySet.has(entityId);

    if (isMatch && !wasMatch) {
      this.entitySet.add(entityId);
      this.entities.push(entityId);
      this.onEntityAdded.emit(entityId);
    } else if (!isMatch && wasMatch) {
      this.entitySet.delete(entityId);
      const idx = this.entities.indexOf(entityId);
      if (idx !== -1) this.entities.splice(idx, 1);
      this.onEntityRemoved.emit(entityId);
    }
  }

  /** @internal — called by World when an entity is removed entirely. */
  _remove(entityId: number): void {
    if (this.entitySet.has(entityId)) {
      this.entitySet.delete(entityId);
      const idx = this.entities.indexOf(entityId);
      if (idx !== -1) this.entities.splice(idx, 1);
      this.onEntityRemoved.emit(entityId);
    }
  }

  /** Iterate matching entity IDs. */
  [Symbol.iterator](): IterableIterator<number> {
    return this.entities[Symbol.iterator]();
  }

  /** Number of matching entities. */
  get count(): number {
    return this.entities.length;
  }

  /** Check if an entity matches this query. */
  has(entityId: number): boolean {
    return this.entitySet.has(entityId);
  }
}

/** Builder for creating queries with .with() / .without() chaining. */
export class QueryBuilder {
  private required = 0;
  private excluded = 0;

  with(...components: ComponentDef<unknown>[]): this {
    for (const c of components) {
      this.required |= c.bit;
    }
    return this;
  }

  without(...components: ComponentDef<unknown>[]): this {
    for (const c of components) {
      this.excluded |= c.bit;
    }
    return this;
  }

  /** Build the query (called internally by World). */
  build(): Query {
    return new Query(this.required, this.excluded);
  }
}
