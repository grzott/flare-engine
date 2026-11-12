import type { SkImageLike, SpriteFrame } from '@flare-engine/assets';
import type { Query, World } from '@flare-engine/ecs';
import { type ComponentDef, defineComponent } from '@flare-engine/ecs';
import { sortByDrawOrder } from './draw-order.js';
import type { SpriteBatch } from './sprite-batch.js';
import type { AnySpriteEffect } from './sprite-effects.js';

/** Position component data expected by the render system. */
export interface PositionData {
  x: number;
  y: number;
}

/** Sprite anchor as a fraction of the destination rect — `(0, 0)` is
 *  top-left (default), `(0.5, 0.5)` is center, `(1, 1)` is bottom-right.
 *  When present, `Position` refers to the anchor point rather than the
 *  sprite's top-left corner. */
export interface SpriteAnchor {
  x: number;
  y: number;
}

/** Sprite component data expected by the render system. */
export interface SpriteData {
  image: SkImageLike;
  frame: SpriteFrame;
  z: number;
  width?: number;
  height?: number;
  /** Optional per-sprite effect (tint, flash, grayscale, outline, custom).
   *  Shared instances are batched together — prefer reusing an effect
   *  reference across entities that should render identically. */
  effect?: AnySpriteEffect;
  /** Optional pivot point for the sprite. Defaults to top-left `(0, 0)`. */
  anchor?: SpriteAnchor;
  /** Per-instance alpha multiplier. Range [0, 1]. Default 1 (fully opaque).
   *  Mutate directly each frame — e.g. `sprite.alpha = lerp(1, 0, t)`.
   *  Sprites with different alphas are placed in separate draw batches. */
  alpha?: number;
  /** Rotation in radians, clockwise (Skia Y-down convention). Default 0.
   *  Applied about the sprite's anchor point. Non-uniform scale combined with
   *  rotation is unsupported — scale is inferred uniformly from dstW/srcW. */
  rotation?: number;
  /**
   * When true, draw via `drawImageRect` so `width` and `height` are honored
   * independently (non-uniform scale). Use for background tiles or any sprite
   * that must fill a non-square destination rect exactly.
   *
   * Default (absent/false): drawn via the batched `drawAtlas` uniform-scale
   * path. Stretched sprites are NOT batched with regular sprites.
   *
   * Rotation is unsupported in stretch mode — combine only with `rotation = 0`.
   */
  stretch?: boolean;
  /**
   * Blend mode for this sprite.
   * `'normal'` (default): standard alpha-over blending.
   * `'additive'`: src + dst pixel colours — glows, particles, bullet trails.
   * Sprites with different blend modes are placed in separate batch runs.
   */
  blend?: 'normal' | 'additive';
  /** Mirror the sprite horizontally. Default false.
   *  Routes through the `drawImageRect` path — per-sprite draw call trade-off.
   *  Unsupported with rotation; combine only with `rotation = 0`. */
  flipX?: boolean;
  /** Mirror the sprite vertically. Default false. Same trade-offs as flipX. */
  flipY?: boolean;
}

/** Below this many slots an add never compacts: nothing worth reclaiming. */
const MIN_COMPACT_COUNT = 16;

/** One query member's slot in the draw order. Pooled: a dead slot is reused by a later add. */
interface RenderEntry {
  entityId: number;
  z: number;
  alive: boolean;
}

/** The per-frame function `createRenderSystem` returns. */
export interface RenderSystem {
  /** Queue this frame's sprite draws into the batch, back to front. */
  (): void;
  /**
   * Unsubscribe from the query's `onEntityAdded` / `onEntityRemoved` signals.
   * Without it the system stays subscribed for as long as the query lives;
   * its storage stays bounded by the live entities either way.
   * A disposed system queues nothing.
   */
  dispose(): void;
}

/**
 * Create a render system function.
 *
 * This is not a defineSystem() wrapper because it needs extra parameters
 * (SpriteBatch) beyond what the ECS system interface provides. Instead,
 * it returns a function to call in your game loop.
 *
 * The returned function only **queues** sprite draws into `batch` — it
 * does not call `batch.flush()`. Flushing is owned by the frame owner
 * (e.g. `<GameView>`) so that all draw sources (ECS, particles, custom)
 * can contribute to a single flush at the render phase.
 *
 * The system keeps its draw order between frames and follows the query
 * through `onEntityAdded` / `onEntityRemoved`, so a frame costs one pass
 * plus the inversions that appeared since the last one. Sprites with equal
 * `z` draw in the order they joined the query. Call `dispose()` on the
 * returned function to drop the subscriptions. Removed entries are reclaimed
 * on add as well as on each frame, so a system that is subscribed but not
 * called does not grow with the number of adds.
 *
 * @param world The ECS world.
 * @param query Query that matches entities with Position + Sprite.
 * @param positionDef ComponentDef for Position.
 * @param spriteDef ComponentDef for Sprite.
 * @param batch SpriteBatch instance to queue draws into.
 */
export function createRenderSystem(
  world: World,
  query: Query,
  positionDef: ComponentDef<PositionData>,
  spriteDef: ComponentDef<SpriteData>,
  batch: SpriteBatch,
): RenderSystem {
  return createProbedRenderSystem(world, query, positionDef, spriteDef, batch).system;
}

/**
 * `createRenderSystem` plus a read of how many entry slots it holds, live and
 * spare. Module-internal: the package barrel does not export it, the tests
 * import it from this file to check that the storage stays bounded.
 *
 * @internal
 */
export function createProbedRenderSystem(
  world: World,
  query: Query,
  positionDef: ComponentDef<PositionData>,
  spriteDef: ComponentDef<SpriteData>,
  batch: SpriteBatch,
): { system: RenderSystem; slotCount: () => number } {
  // entries[0..count) is the draw order, kept from frame to frame; anything
  // past count is a spare slot waiting for the next add.
  const entries: RenderEntry[] = [];
  const byEntity = new Map<number, RenderEntry>();
  let count = 0;
  // Dead slots inside entries[0..count).
  let dead = 0;

  // Closes the gaps dead slots left, keeping the live ones in order. A dead
  // slot is swapped behind the live ones, not dropped, so it is reused.
  const compact = (): void => {
    let live = 0;
    for (let i = 0; i < count; i++) {
      const entry = entries[i]!;
      if (!entry.alive) continue;
      if (live !== i) {
        entries[i] = entries[live]!;
        entries[live] = entry;
      }
      live++;
    }
    count = live;
    dead = 0;
    // Shrink policy — avoid thrashing on variable entity counts.
    if (entries.length > count * 2 && entries.length > 64) {
      entries.length = count;
    }
  };

  const onAdded = (entityId: number): void => {
    if (byEntity.has(entityId)) return;
    // The frame may never run (paused, or dropped without dispose()), so adds
    // reclaim too: once the dead outnumber the live, which keeps the cost
    // amortized O(1) per add. Appending after it keeps join order; filling a
    // dead slot in place would not.
    if (dead > count - dead && count > MIN_COMPACT_COUNT) compact();
    let entry = entries[count];
    if (entry) {
      entry.entityId = entityId;
      entry.z = 0;
      entry.alive = true;
    } else {
      entry = { entityId, z: 0, alive: true };
      entries.push(entry);
    }
    count++;
    byEntity.set(entityId, entry);
  };

  // Only marks the slot: a removal followed by a re-add in the same frame
  // leaves one dead slot and one live one, and the next compaction drops the dead.
  const onRemoved = (entityId: number): void => {
    const entry = byEntity.get(entityId);
    if (!entry) return;
    entry.alive = false;
    dead++;
    byEntity.delete(entityId);
  };

  const ids = query.entities;
  for (let n = 0; n < ids.length; n++) onAdded(ids[n]!);
  const unsubscribeAdded = query.onEntityAdded.add(onAdded);
  const unsubscribeRemoved = query.onEntityRemoved.add(onRemoved);

  const renderSystem = (): void => {
    if (dead > 0) compact();
    for (let i = 0; i < count; i++) {
      const entry = entries[i]!;
      const sprite = world.get(entry.entityId, spriteDef);
      if (sprite) entry.z = sprite.z;
    }
    // Already in last frame's order, so this costs n plus the new inversions.
    sortByDrawOrder(entries, count);

    // Queue draws in z-order
    for (let j = 0; j < count; j++) {
      const entry = entries[j]!;
      const pos = world.get(entry.entityId, positionDef);
      const sprite = world.get(entry.entityId, spriteDef);
      if (!pos || !sprite) continue;

      const anchor = sprite.anchor;
      batch.draw(
        sprite.image,
        sprite.frame,
        pos.x,
        pos.y,
        sprite.width,
        sprite.height,
        sprite.effect,
        anchor ? anchor.x : 0,
        anchor ? anchor.y : 0,
        sprite.alpha ?? 1,
        sprite.rotation ?? 0,
        sprite.stretch ?? false,
        sprite.blend ?? 'normal',
        sprite.flipX ?? false,
        sprite.flipY ?? false,
      );
    }
  };

  const dispose = (): void => {
    unsubscribeAdded();
    unsubscribeRemoved();
    byEntity.clear();
    entries.length = 0;
    count = 0;
    dead = 0;
  };

  return {
    system: Object.assign(renderSystem, { dispose }),
    slotCount: () => entries.length,
  };
}

/** Canonical Sprite component — queried by the render system alongside `Position`. */
export const Sprite = defineComponent<SpriteData>('Sprite', () => ({
  image: null as unknown as SkImageLike,
  frame: { name: '', x: 0, y: 0, w: 0, h: 0 },
  z: 0,
}));
