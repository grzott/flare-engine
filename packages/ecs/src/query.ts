import { Signal } from '@flare-engine/events';
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

  /**
   * Matching entity IDs, in no guaranteed order.
   *
   * Entities are appended as they begin matching and removed by swapping the
   * last element into the hole, so the order reflects match history, not id.
   * It was previously documented as "sorted", which was never true: `_check`
   * has always plain-`push`ed, so an entity that starts matching later lands
   * after entities with higher ids (spawn 1,2,3 then add the missing component
   * to 3 first and the array reads `[3, 1, 2]`).
   *
   * The one consumer that cares is `render-system`, whose `sortByDrawOrder` is
   * a *stable* insertion sort on `z` alone — so this order is the tie-break
   * between equal-`z` sprites. It is deliberately not a guarantee: depend on
   * `z`, not on the order entities happen to occupy here.
   */
  private entities: number[] = [];
  /**
   * `entityId -> index into entities`. Serves membership *and* position, which
   * is what makes removal O(1): the previous pair of a `Set` plus `indexOf`
   * made every removal a linear scan, so churn cost grew as `n * removals`
   * rather than with the number of removals.
   */
  private index = new Map<number, number>();

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
    const wasMatch = this.index.has(entityId);

    if (isMatch && !wasMatch) {
      this.index.set(entityId, this.entities.length);
      this.entities.push(entityId);
      this.onEntityAdded.emit(entityId);
    } else if (!isMatch && wasMatch) {
      this.swapRemove(entityId);
      this.onEntityRemoved.emit(entityId);
    }
  }

  /** @internal — called by World when an entity is removed entirely. */
  _remove(entityId: number): void {
    if (this.index.has(entityId)) {
      this.swapRemove(entityId);
      this.onEntityRemoved.emit(entityId);
    }
  }

  /**
   * O(1) removal: move the last element into the hole and shorten by one.
   *
   * Order-preserving removal cannot be O(1) here — `splice` shifts every later
   * element, and a position map would then need every shifted index rewritten,
   * so it costs the same scan it was meant to remove. A tombstone would keep
   * order but puts a branch in iteration, which at realistic churn runs far
   * more often than removal and would slow the steady-state path to speed up
   * the rare one.
   */
  private swapRemove(entityId: number): void {
    const idx = this.index.get(entityId) as number;
    const last = this.entities.length - 1;
    const lastId = this.entities[last] as number;
    this.entities[idx] = lastId;
    this.index.set(lastId, idx);
    this.entities.pop();
    this.index.delete(entityId);
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
    return this.index.has(entityId);
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
