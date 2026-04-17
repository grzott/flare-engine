import type { ComponentDef } from './component.js';
import { Query, QueryBuilder } from './query.js';

/**
 * World is the central ECS container.
 *
 * Entities are integer IDs. Components are stored in per-component Maps.
 * Archetype bitmasks enable fast query matching.
 */
export class World {
  private nextId = 1;
  private archetypes = new Map<number, number>(); // entityId → bitmask
  private componentStores = new Map<number, Map<number, unknown>>(); // componentId → (entityId → data)
  private queries: Query[] = [];
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

    // Remove from all component stores
    for (const [, store] of this.componentStores) {
      store.delete(entityId);
    }

    this.archetypes.delete(entityId);

    // Notify queries
    for (const query of this.queries) {
      query._remove(entityId);
    }
  }

  /** Add a component to an entity. */
  add<T>(entityId: number, def: ComponentDef<T>, data?: T): void {
    const arch = this.archetypes.get(entityId);
    if (arch === undefined) return;

    // Store component data
    let store = this.componentStores.get(def.id);
    if (!store) {
      store = new Map();
      this.componentStores.set(def.id, store);
    }
    store.set(entityId, data !== undefined ? data : def.create());

    // Update archetype
    const newArch = arch | def.bit;
    this.archetypes.set(entityId, newArch);

    // Notify queries
    for (const query of this.queries) {
      query._check(entityId, newArch);
    }
  }

  /** Remove a component from an entity. */
  remove<T>(entityId: number, def: ComponentDef<T>): void {
    const arch = this.archetypes.get(entityId);
    if (arch === undefined) return;

    const store = this.componentStores.get(def.id);
    if (store) store.delete(entityId);

    const newArch = arch & ~def.bit;
    this.archetypes.set(entityId, newArch);

    // Notify queries
    for (const query of this.queries) {
      query._check(entityId, newArch);
    }
  }

  /** Get component data for an entity. */
  get<T>(entityId: number, def: ComponentDef<T>): T | undefined {
    const store = this.componentStores.get(def.id);
    return store?.get(entityId) as T | undefined;
  }

  /** Check if entity has a component. */
  has(entityId: number, def: ComponentDef<unknown>): boolean {
    const arch = this.archetypes.get(entityId);
    return arch !== undefined && (arch & def.bit) !== 0;
  }

  /** Check if entity exists. */
  exists(entityId: number): boolean {
    return this.archetypes.has(entityId);
  }

  /**
   * Create a query. Queries auto-update as entities change.
   * Use the QueryBuilder-style chaining:
   *   world.query(Position, Velocity)
   * Or use the builder:
   *   world.queryBuilder().with(Position).without(Dead).build()
   */
  query(...components: ComponentDef<unknown>[]): Query {
    let mask = 0;
    for (const c of components) {
      mask |= c.bit;
    }
    const q = new Query(mask, 0);
    this.queries.push(q);

    // Populate with existing entities
    for (const [entityId, arch] of this.archetypes) {
      q._check(entityId, arch);
    }

    return q;
  }

  /** Create a QueryBuilder for complex queries (with/without). */
  queryBuilder(): QueryBuilder {
    return new _WorldQueryBuilder(this);
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

  /** @internal Register a query for auto-update. */
  _registerQuery(q: Query): void {
    this.queries.push(q);
    // Populate with existing entities
    for (const [entityId, arch] of this.archetypes) {
      q._check(entityId, arch);
    }
  }
}

/**
 * Internal query builder that auto-registers with a World.
 */
class _WorldQueryBuilder extends QueryBuilder {
  private world: World;

  constructor(world: World) {
    super();
    this.world = world;
  }

  override build(): Query {
    const q = super.build();
    this.world._registerQuery(q);
    return q;
  }
}
