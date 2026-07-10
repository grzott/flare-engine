/** A single frame rectangle in a sprite sheet. */
export interface SpriteFrame {
  /** Name/key of the frame. */
  name: string;
  /** X offset in the source texture (pixels). */
  x: number;
  /** Y offset in the source texture (pixels). */
  y: number;
  /** Width of the frame (pixels). */
  w: number;
  /** Height of the frame (pixels). */
  h: number;
}

/** A named animation sequence within a sprite sheet. */
export interface AnimationSequence {
  /** Sequence name (e.g. "walk", "idle"). */
  name: string;
  /** Indices into the SpriteSheet.frames array. */
  frameIndices: number[];
  /** Duration per frame in seconds. */
  frameDuration: number;
  /** Whether to loop the sequence. */
  loop: boolean;
}

/** Parsed sprite sheet data — pure data, no Skia dependency. */
export interface SpriteSheet {
  /** Ordered array of all frames. */
  frames: SpriteFrame[];
  /** Map from frame name to index in frames[]. */
  frameMap: Map<string, number>;
  /** Named animation sequences. */
  animations: Map<string, AnimationSequence>;
}

/** Create an empty sprite sheet. */
export function createSpriteSheet(): SpriteSheet {
  return {
    frames: [],
    frameMap: new Map(),
    animations: new Map(),
  };
}

// ----- Rotated-frame dev warning -----

declare const __DEV__: boolean | undefined;

/**
 * Warn (dev builds only) when a TexturePacker frame is exported rotated.
 * Rotated frames are not yet remapped, so they render sideways — the frame is
 * named so the artist can re-export it. Full rotation support is post-launch.
 */
function warnRotatedFrame(name: string): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(
      `[flare-engine/assets] sprite frame "${name}": rotation unsupported — re-export without rotation`,
    );
  }
}

// ----- TexturePacker JSON (hash format) -----

interface TPHashFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
}

interface TPHashJSON {
  frames: Record<string, TPHashFrame>;
}

/** Parse TexturePacker JSON hash format. */
export function parseTexturePackerHash(json: unknown): SpriteSheet {
  const data = json as TPHashJSON;
  const sheet = createSpriteSheet();
  const entries = Object.entries(data.frames);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;
    const [name, value] = entry;
    if (value.rotated) warnRotatedFrame(name);
    const f = value.frame;
    sheet.frames.push({ name, x: f.x, y: f.y, w: f.w, h: f.h });
    sheet.frameMap.set(name, i);
  }
  return sheet;
}

// ----- TexturePacker JSON (array format) -----

interface TPArrayFrame {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
}

interface TPArrayJSON {
  frames: TPArrayFrame[];
}

/** Parse TexturePacker JSON array format. */
export function parseTexturePackerArray(json: unknown): SpriteSheet {
  const data = json as TPArrayJSON;
  const sheet = createSpriteSheet();
  for (let i = 0; i < data.frames.length; i++) {
    const entry = data.frames[i];
    if (!entry) continue;
    if (entry.rotated) warnRotatedFrame(entry.filename);
    const f = entry.frame;
    sheet.frames.push({
      name: entry.filename,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    });
    sheet.frameMap.set(entry.filename, i);
  }
  return sheet;
}

// ----- Aseprite JSON -----

interface AsepriteFrame {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  duration: number; // ms
}

interface AsepriteTag {
  name: string;
  from: number;
  to: number;
  direction: string;
}

interface AsepriteJSON {
  frames: AsepriteFrame[] | Record<string, AsepriteFrame>;
  meta?: {
    frameTags?: AsepriteTag[];
  };
}

/** Parse Aseprite JSON export. */
export function parseAseprite(json: unknown): SpriteSheet {
  const data = json as AsepriteJSON;
  const sheet = createSpriteSheet();

  // Aseprite can export frames as array or object
  const frameEntries: AsepriteFrame[] = Array.isArray(data.frames)
    ? data.frames
    : Object.values(data.frames);

  for (let i = 0; i < frameEntries.length; i++) {
    const entry = frameEntries[i];
    if (!entry) continue;
    const f = entry.frame;
    sheet.frames.push({
      name: entry.filename,
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    });
    sheet.frameMap.set(entry.filename, i);
  }

  // Parse frame tags as animation sequences
  const tags = data.meta?.frameTags;
  if (tags) {
    for (const tag of tags) {
      const indices: number[] = [];
      if (tag.direction === 'reverse') {
        for (let i = tag.to; i >= tag.from; i--) {
          indices.push(i);
        }
      } else if (tag.direction === 'pingpong') {
        for (let i = tag.from; i <= tag.to; i++) {
          indices.push(i);
        }
        for (let i = tag.to - 1; i > tag.from; i--) {
          indices.push(i);
        }
      } else {
        // "forward" or default
        for (let i = tag.from; i <= tag.to; i++) {
          indices.push(i);
        }
      }

      // Use the first frame's duration as the uniform frame duration
      const firstFrame = frameEntries[tag.from];
      const durationMs = firstFrame?.duration ?? 100;

      sheet.animations.set(tag.name, {
        name: tag.name,
        frameIndices: indices,
        frameDuration: durationMs / 1000,
        loop: true,
      });
    }
  }

  return sheet;
}

/**
 * Add a custom animation sequence to a sprite sheet.
 */
export function addAnimation(
  sheet: SpriteSheet,
  name: string,
  frameIndices: number[],
  frameDuration: number,
  loop = true,
): void {
  sheet.animations.set(name, { name, frameIndices, frameDuration, loop });
}

/** Get a frame by name. Returns undefined if not found. */
export function getFrame(sheet: SpriteSheet, name: string): SpriteFrame | undefined {
  const idx = sheet.frameMap.get(name);
  if (idx === undefined) return undefined;
  return sheet.frames[idx];
}
