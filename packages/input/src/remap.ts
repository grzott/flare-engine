import type { GamepadSnapshot } from './gamepad.js';

/**
 * Button / axis remap table.
 *
 * `buttons[logicalId] = physicalIndex` — to poll A, read
 * `snapshot.buttons[table.buttons[GamepadButton.A]]`.
 *
 * `axes` maps logical axis id → `{ index, invert, scale }`. Most games invert
 * Y on some controllers; `scale` supports half-range triggers.
 */
export interface AxisMap {
  index: number;
  invert: boolean;
  scale: number;
}

export interface RemapTable {
  buttons: number[];
  axes: AxisMap[];
}

export function createIdentityRemap(buttonCount = 17, axisCount = 4): RemapTable {
  const buttons = new Array<number>(buttonCount);
  for (let i = 0; i < buttonCount; i++) buttons[i] = i;
  const axes = new Array<AxisMap>(axisCount);
  for (let i = 0; i < axisCount; i++) axes[i] = { index: i, invert: false, scale: 1 };
  return { buttons, axes };
}

/** Apply a remap table to a raw snapshot, returning a new snapshot with logical ordering. */
export function applyRemap(snapshot: GamepadSnapshot, table: RemapTable): GamepadSnapshot {
  return applyRemapInto(snapshot, table, { id: '', index: 0, timestamp: 0, buttons: [], axes: [] });
}

/**
 * Zero-alloc form of `applyRemap`: writes the logical-ordered snapshot into
 * `out` and returns it. `out.buttons` / `out.axes` are resized to the table, so
 * a scratch already at the table's size allocates nothing; growing allocates
 * the missing button records once. `out` must not be `snapshot`.
 */
export function applyRemapInto(
  snapshot: GamepadSnapshot,
  table: RemapTable,
  out: GamepadSnapshot,
): GamepadSnapshot {
  const buttonCount = table.buttons.length;
  const buttons = out.buttons;
  if (buttons.length > buttonCount) buttons.length = buttonCount;
  for (let logical = 0; logical < buttonCount; logical++) {
    const src = snapshot.buttons[table.buttons[logical] ?? logical];
    const pressed = src?.pressed ?? false;
    const value = src?.value ?? 0;
    const dst = buttons[logical];
    if (dst) {
      dst.pressed = pressed;
      dst.value = value;
    } else {
      buttons[logical] = { pressed, value };
    }
  }
  const axisCount = table.axes.length;
  const axes = out.axes;
  if (axes.length > axisCount) axes.length = axisCount;
  for (let logical = 0; logical < axisCount; logical++) {
    const map = table.axes[logical];
    const raw = snapshot.axes[map ? map.index : logical] ?? 0;
    axes[logical] = map ? raw * map.scale * (map.invert ? -1 : 1) : raw;
  }
  out.id = snapshot.id;
  out.index = snapshot.index;
  out.timestamp = snapshot.timestamp;
  return out;
}

/**
 * Minimal storage contract — matches `@flare-engine/storage` `StorageAdapter`,
 * but declared locally so this package does not take a hard dep on storage.
 */
export interface RemapStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

/** Persist a remap table under the given key. Throws on invalid table shape. */
export async function saveRemap(store: RemapStore, key: string, table: RemapTable): Promise<void> {
  await store.set(key, JSON.stringify(table));
}

/** Load a remap table. Returns `null` if absent or malformed. */
export async function loadRemap(store: RemapStore, key: string): Promise<RemapTable | null> {
  const raw = await store.get(key);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRemapTable(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isRemapTable(value: unknown): value is RemapTable {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as { buttons?: unknown; axes?: unknown };
  if (!Array.isArray(obj.buttons) || !Array.isArray(obj.axes)) return false;
  for (const b of obj.buttons) if (typeof b !== 'number') return false;
  for (const a of obj.axes) {
    if (typeof a !== 'object' || a === null) return false;
    const ax = a as { index?: unknown; invert?: unknown; scale?: unknown };
    if (
      typeof ax.index !== 'number' ||
      typeof ax.invert !== 'boolean' ||
      typeof ax.scale !== 'number'
    ) {
      return false;
    }
  }
  return true;
}
