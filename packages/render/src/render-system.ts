import type { SkImageLike } from '@flare-engine/assets';
import type { SpriteFrame } from '@flare-engine/assets';
import type { World } from '@flare-engine/ecs';
import type { Query } from '@flare-engine/ecs';
import { type ComponentDef, defineComponent } from '@flare-engine/ecs';
import { sortByDrawOrder } from './draw-order.js';
import type { SpriteBatch } from './sprite-batch.js';
import type { AnySpriteEffect } from './sprite-effects.js';

/** Position component data expected by the render system. */
export interface PositionData {
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
}

/** Cached entry for sorting. Reused each frame to avoid allocs. */
interface RenderEntry {
  entityId: number;
  z: number;
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
): () => void {
  // Pre-allocated sorted array — grows as needed, never shrinks
  const entries: RenderEntry[] = [];

  return () => {
    // Collect entities
    let i = 0;
    for (const entityId of query) {
      const sprite = world.get(entityId, spriteDef);
      if (!sprite) continue;

      if (i >= entries.length) {
        entries.push({ entityId, z: 0 });
      }
      const entry = entries[i]!;
      entry.entityId = entityId;
      entry.z = sprite.z;
      i++;
    }

    // Shrink policy — avoid thrashing on variable entity counts.
    const count = i;
    if (entries.length > count * 2 && entries.length > 64) {
      entries.length = count;
    }
    // Zero-alloc: sort the pooled array in place, bounded to live count.
    sortByDrawOrder(entries, count);

    // Queue draws in z-order
    for (let j = 0; j < count; j++) {
      const entry = entries[j]!;
      const pos = world.get(entry.entityId, positionDef);
      const sprite = world.get(entry.entityId, spriteDef);
      if (!pos || !sprite) continue;

      batch.draw(
        sprite.image,
        sprite.frame,
        pos.x,
        pos.y,
        sprite.width,
        sprite.height,
        sprite.effect,
      );
    }
  };
}

/** Canonical Sprite component — queried by the render system alongside `Position`. */
export const Sprite = defineComponent<SpriteData>('Sprite', () => ({
  image: null as unknown as SkImageLike,
  frame: { name: '', x: 0, y: 0, w: 0, h: 0 },
  z: 0,
}));
