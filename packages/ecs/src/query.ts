import { Signal } from '@flare-engine/events';
import type { ComponentDef } from './component.js';

/**
 * Query matches entities based on component archetypes.
 *
 * Uses bitmask matching: entity archetype & requiredMask === requiredMask
 * and entity archetype & excludedMask === 0.
 *
 * Two ways to walk the matches:
 * - `entities` — the live id array, for an indexed `for` loop. Allocates
 *   nothing; this is the form for systems and anything else that runs per frame.
 * - `for...of` — the convenience form. It creates an iterator, and on Hermes
 *   (React Native) one `{ value, done }` object per entity per pass, so keep
 *   it off the frame path.
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

  private ids: number[] = [];
  /**
   * `entityId -> index into ids`. Serves membership *and* position, which
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
      this.index.set(entityId, this.ids.length);
      this.ids.push(entityId);
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
    const last = this.ids.length - 1;
    const lastId = this.ids[last] as number;
    this.ids[idx] = lastId;
    this.index.set(lastId, idx);
    this.ids.pop();
    this.index.delete(entityId);
  }

  /**
   * Matching entity IDs — the live array, not a copy, so reading it allocates
   * nothing and it reflects every add and remove as it happens. Walk it by
   * index on hot paths:
   *
   *   const ids = query.entities;
   *   for (let i = 0; i < ids.length; i++) { const id = ids[i]!; ... }
   *
   * Because it is live, destroying an entity or changing its components mid-walk
   * swap-removes from this array under the loop and skips an entity: collect
   * first and act after, as the built-in systems do.
   *
   * Order is not guaranteed. Entities are appended as they begin matching and
   * removed by swapping the last element into the hole, so the order reflects
   * match history, not id. It was previously documented as "sorted", which was
   * never true: `_check` has always plain-`push`ed, so an entity that starts
   * matching later lands after entities with higher ids (spawn 1,2,3 then add
   * the missing component to 3 first and the array reads `[3, 1, 2]`).
   *
   * The one consumer that cares is `render-system`, whose `sortByDrawOrder` is
   * a *stable* insertion sort on `z` alone — so this order is the tie-break
   * between equal-`z` sprites. It is deliberately not a guarantee: depend on
   * `z`, not on the order entities happen to occupy here.
   */
  get entities(): readonly number[] {
    return this.ids;
  }

  /**
   * Iterate matching entity IDs. Convenience form: it allocates an iterator,
   * and on Hermes a result object per entity — walk `entities` by index on
   * hot paths.
   */
  [Symbol.iterator](): IterableIterator<number> {
    return this.ids[Symbol.iterator]();
  }

  /** Number of matching entities. */
  get count(): number {
    return this.ids.length;
  }

  /** Check if an entity matches this query. */
  has(entityId: number): boolean {
    return this.index.has(entityId);
  }
}

/**
 * Builder for creating queries with .with() / .without() chaining.
 *
 * Obtain one from `world.queryBuilder()`. `build()` hands the finished Query to
 * the World it came from, which is what keeps it populated; the registration
 * hook is a required constructor argument so a builder cannot exist without a
 * World behind it, and the orphan `new QueryBuilder().build()` does not compile.
 */
export class QueryBuilder {
  private required = 0;
  private excluded = 0;
  private readonly register: (q: Query) => void;

  constructor(register: (q: Query) => void) {
    this.register = register;
  }

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

  /** Build the query and register it with the owning World. */
  build(): Query {
    const q = new Query(this.required, this.excluded);
    this.register(q);
    return q;
  }
}
