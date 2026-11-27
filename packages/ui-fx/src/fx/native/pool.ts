import { makeMutable, type SharedValue } from 'react-native-reanimated';

/** How many sprites the host's one `<Atlas>` draws (C38). */
export const SPRITE_POOL_CAPACITY = 4096;

// An RSXform, a source rect and a colour are four floats each.
const FLOATS = 4;

/**
 * The sprites of one `<Atlas>` that stays mounted, shared by every run that draws sprites.
 *
 * `claim` and `free` run on the JS thread. The buffers live on the UI thread: a run's worklet
 * writes its own range, and reads nothing outside it. The `<Atlas>` hears of a write through
 * `modify`, so a buffer written in place needs a `modify` after it.
 */
export interface SpritePool {
  readonly capacity: number;
  /** `[scos, ssin, tx, ty]` per sprite. An idle sprite is all zeros, so it draws at zero scale. */
  readonly transforms: SharedValue<Float32Array>;
  /** `[x, y, width, height]` per sprite: its source rect in the capture, in image pixels. */
  readonly rects: SharedValue<Float32Array>;
  /**
   * `[r, g, b, a]` per sprite, each 0..1, multiplied into the sprite. An idle sprite is white, so
   * a run that writes no colour draws its sprites as they are in the capture.
   */
  readonly colors: SharedValue<Float32Array>;
  /** The first index of a free contiguous range of `count` sprites, now claimed, or -1. */
  claim(count: number): number;
  /** Hand a claimed range back. Its sprites return to zero scale, and to white. */
  free(start: number, count: number): void;
}

function clearSprites(buffer: Float32Array, start: number, count: number): void {
  'worklet';
  buffer.fill(0, start * FLOATS, (start + count) * FLOATS);
}

/** A pool of `capacity` sprites, all idle. A host makes one, for its whole life. */
export function createSpritePool(capacity: number): SpritePool {
  const used = new Uint8Array(capacity);
  const transforms = makeMutable<Float32Array>(new Float32Array(capacity * FLOATS));
  const rects = makeMutable<Float32Array>(new Float32Array(capacity * FLOATS));
  const colors = makeMutable<Float32Array>(new Float32Array(capacity * FLOATS).fill(1));

  return {
    capacity,
    transforms,
    rects,
    colors,
    claim(count) {
      if (count <= 0 || count > capacity) return -1;
      let run = 0;
      for (let i = 0; i < capacity; i++) {
        run = used[i] === 0 ? run + 1 : 0;
        if (run === count) {
          const start = i - count + 1;
          used.fill(1, start, i + 1);
          return start;
        }
      }
      return -1;
    },
    free(start, count) {
      used.fill(0, start, start + count);
      const clear = <T extends Float32Array>(buffer: T): T => {
        'worklet';
        clearSprites(buffer, start, count);
        return buffer;
      };
      const whiten = <T extends Float32Array>(buffer: T): T => {
        'worklet';
        buffer.fill(1, start * FLOATS, (start + count) * FLOATS);
        return buffer;
      };
      transforms.modify(clear);
      rects.modify(clear);
      colors.modify(whiten);
    },
  };
}
