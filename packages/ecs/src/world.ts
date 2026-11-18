import type { ComponentDef } from './component.js';
import { Query, QueryBuilder } from './query.js';

interface ComponentSlot {
  readonly bit: number;
  readonly store: Map<number, unknown>; // entityId → data
}

const MAX_COMPONENT_TYPES = 32;

/**
 * World is the central ECS container.
 *
 * Entities are integer IDs. Components are stored in per-component Maps.
 * Archetype bitmasks enable fast query matching.
 */
export class World {
  private nextId = 1;
  private archetypes = new Map<number, number>(); // entityId → bitmask
  private slots = new Map<ComponentDef<unknown>, ComponentSlot>();
  private usedBits = 0;
  private storesByBit: (Map<number, unknown> | undefined)[] = new Array(MAX_COMPONENT_TYPES).fill(
    undefined,
  );
  private queries: Query[] = [];
  private queryIterDepth = 0;
  private pendingQueryRemove: Query[] | null = null;
  private systems: {
    fn: (world: World, dt: number) => void;
    priority: number;
  }[] = [];
  private systemsSorted = false;

  /** Create a new entity. Returns the entity ID. */
  spawn(): number {
    const id = this.nextId++;
    this.archetypes.set(id, 0);
    return id;
  }

  /** Remove an entity and all its components. */
  destroy(entityId: number): void {
    const arch = this.archetypes.get(entityId);
    if (arch === undefined) return;

    // Clear the lowest set bit each pass, so only the stores this entity is in are touched.
    for (let m = arch; m !== 0; m &= m - 1) {
      this.storesByBit[31 - Math.clz32(m & -m)]?.delete(entityId);
    }

    this.archetypes.delete(entityId);

    this.notifyQueries(entityId, 0, true);
  }

  /** Add a component to an entity. */
  add<T>(entityId: number, def: ComponentDef<T>, data?: T): void {
    const arch = this.archetypes.get(entityId);
    if (arch === undefined) return;

    const slot = this.slotFor(def);
    slot.store.set(entityId, data !== undefined ? data : def.create());

    const newArch = arch | slot.bit;
    this.archetypes.set(entityId, newArch);

    this.notifyQueries(entityId, newArch, false);
  }

  /** Remove a component from an entity. */
  remove<T>(entityId: number, def: ComponentDef<T>): void {
    const arch = this.archetypes.get(entityId);
    if (arch === undefined) return;

    const slot = this.slots.get(def);
    if (slot === undefined) return;
    slot.store.delete(entityId);

    const newArch = arch & ~slot.bit;
    this.archetypes.set(entityId, newArch);

    this.notifyQueries(entityId, newArch, false);
  }

  /** Get component data for an entity. */
  get<T>(entityId: number, def: ComponentDef<T>): T | undefined {
    return this.slots.get(def)?.store.get(entityId) as T | undefined;
  }

  /** Check if entity has a component. */
  has(entityId: number, def: ComponentDef<unknown>): boolean {
    const slot = this.slots.get(def);
    if (slot === undefined) return false;
    const arch = this.archetypes.get(entityId);
    return arch !== undefined && (arch & slot.bit) !== 0;
  }

  /**
   * The slot a definition holds in this World, assigned on first use. Within one
   * copy of the package ids are unique, so every definition keeps its own `bit`
   * and query masks stay the OR of `def.bit`. Only a definition whose bit is
   * already held here (a second copy of the package, a hand-built literal, reuse
   * after `_resetComponentIds`) gets another one, where it used to share storage.
   */
  private slotFor(def: ComponentDef<unknown>): ComponentSlot {
    const known = this.slots.get(def);
    if (known !== undefined) return known;

    const free = ~this.usedBits;
    if (free === 0) throw capacityError(def);
    const own = def.bit | 0;
    const isFreeSingleBit = own !== 0 && (own & (own - 1)) === 0 && (own & free) !== 0;
    const bit = isFreeSingleBit ? own : free & -free;

    const slot: ComponentSlot = { bit, store: new Map() };
    this.slots.set(def, slot);
    this.usedBits |= bit;
    this.storesByBit[31 - Math.clz32(bit)] = slot.store;
    return slot;
  }

  /** Mask for a set of definitions. Checks room for all of them before assigning any slot. */
  private maskOf(defs: readonly ComponentDef<unknown>[]): number {
    let room = MAX_COMPONENT_TYPES - this.slots.size;
    let i = 0;
    for (const def of defs) {
      if (!this.slots.has(def) && defs.indexOf(def) === i && room-- === 0) {
        throw capacityError(def);
      }
      i++;
    }

    let mask = 0;
    for (const def of defs) {
      mask |= this.slotFor(def).bit;
    }
    return mask;
  }

  /** Check if entity exists. */
  exists(entityId: number): boolean {
    return this.archetypes.has(entityId);
  }

  /** Number of live entities. */
  get entityCount(): number {
    return this.archetypes.size;
  }

  /**
   * Walk every live entity ID. Iterates the live archetype map directly, with no
   * array snapshot. Archetype changes (add/remove component) keep the same entity
   * keys, so iteration is stable across them. Destroying entities inside the
   * callback is safe, but entities spawned inside it are visited in the same pass
   * (live Map iteration) — don't spawn from within.
   */
  forEachEntity(cb: (entity: number) => void): void {
    for (const entityId of this.archetypes.keys()) {
      cb(entityId);
    }
  }

  /**
   * Create a query. Queries auto-update as entities change.
   * Use the QueryBuilder-style chaining:
   *   world.query(Position, Velocity)
   * Or use the builder:
   *   world.queryBuilder().with(Position).without(Dead).build()
   */
  query(...components: ComponentDef<unknown>[]): Query {
    const q = new Query(this.maskOf(components), 0);
    this.register(q);
    return q;
  }

  /** Create a QueryBuilder for complex queries (with/without). */
  queryBuilder(): QueryBuilder {
    return new QueryBuilder(
      (q) => this.register(q),
      (defs) => this.maskOf(defs),
    );
  }

  /** Track a query and populate it with the entities that already match. */
  private register(q: Query): void {
    this.queries.push(q);
    for (const [entityId, arch] of this.archetypes) {
      q._check(entityId, arch);
    }
  }

  /**
   * Dispose a query created by `query()` or `queryBuilder().build()`. Afterwards
   * the world stops updating it, so it no longer costs spawn/add/remove iteration
   * time. The query is left inert — drop the reference to let it be collected.
   *
   * Safe to call from within a Query signal handler (e.g. a one-shot
   * `onEntityAdded` that disposes its own query): the removal is deferred until
   * the in-progress mutation finishes iterating, so no other query is skipped.
   */
  removeQuery(q: Query): void {
    if (this.queryIterDepth > 0) {
      if (this.pendingQueryRemove === null) this.pendingQueryRemove = [];
      this.pendingQueryRemove.push(q);
      return;
    }
    const idx = this.queries.indexOf(q);
    if (idx !== -1) this.queries.splice(idx, 1);
  }

  /** Notify queries in order, deferring any removeQuery until the loop unwinds. */
  private notifyQueries(entityId: number, arch: number, destroyed: boolean): void {
    this.queryIterDepth++;
    try {
      if (destroyed) {
        for (const query of this.queries) {
          query._remove(entityId);
        }
      } else {
        for (const query of this.queries) {
          query._check(entityId, arch);
        }
      }
    } finally {
      this.endQueryIteration();
    }
  }

  /** @internal End a query-notify loop; flush any removeQuery deferred during it. */
  private endQueryIteration(): void {
    this.queryIterDepth--;
    if (this.queryIterDepth === 0 && this.pendingQueryRemove !== null) {
      for (const q of this.pendingQueryRemove) {
        const idx = this.queries.indexOf(q);
        if (idx !== -1) this.queries.splice(idx, 1);
      }
      this.pendingQueryRemove.length = 0;
    }
  }

  /** Register a system function. Lower priority runs first. */
  addSystem(fn: (world: World, dt: number) => void, priority = 0): void {
    this.systems.push({ fn, priority });
    this.systemsSorted = false;
  }

  /** Remove a system. */
  removeSystem(fn: (world: World, dt: number) => void): void {
    const idx = this.systems.findIndex((s) => s.fn === fn);
    if (idx !== -1) this.systems.splice(idx, 1);
  }

  /** Run all systems in priority order. */
  step(dt: number): void {
    if (!this.systemsSorted) {
      this.systems.sort((a, b) => a.priority - b.priority);
      this.systemsSorted = true;
    }
    for (const sys of this.systems) {
      sys.fn(this, dt);
    }
  }
}

function capacityError(def: ComponentDef<unknown>): Error {
  return new Error(`A World holds at most 32 component types (registering "${def.name}")`);
}
