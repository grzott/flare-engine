import {
  type FlarePreset,
  isSnapshotPreset,
  type LivePreset,
  type PresetCommon,
  presetDuration,
  type SnapshotPreset,
} from './presets';

/** One preset of a timeline. `start` is seconds from the timeline's start to the preset's trigger. */
export interface TimelineEntry<P = FlarePreset> {
  start: number;
  preset: P;
}

/**
 * Presets placed in time. Nested timelines are flattened into `entries`, in the order the items
 * were given. `duration` is seconds from the start to the latest end, trailing delays included.
 */
export interface FlareTimeline {
  kind: 'timeline';
  entries: readonly TimelineEntry[];
  duration: number;
}

type TimelineItem = FlarePreset | FlareTimeline;

// Seconds. Starts are sums of floats, so two steps meant for the same moment can differ by rounding.
const START_EPSILON = 1e-9;

function checkSeconds(name: string, field: string, value: number): void {
  if (Number.isFinite(value) && value >= 0) return;
  throw new RangeError(`${name}: ${field} must be a finite number >= 0, got ${value}`);
}

const durationOf = (item: TimelineItem): number =>
  item.kind === 'timeline' ? item.duration : presetDuration(item);

function pushAt(entries: TimelineEntry[], item: TimelineItem, offset: number): void {
  if (item.kind !== 'timeline') {
    entries.push(Object.freeze({ start: offset, preset: item }));
    return;
  }
  for (const entry of item.entries) {
    entries.push(Object.freeze({ start: offset + entry.start, preset: entry.preset }));
  }
}

function findSnapshot(entries: readonly TimelineEntry[]): TimelineEntry | null {
  let found: TimelineEntry | null = null;
  for (const entry of entries) {
    if (isSnapshotPreset(entry.preset) && (found === null || entry.start < found.start)) {
      found = entry;
    }
  }
  return found;
}

/** A snapshot step hides the live view, so nothing may start after it and there is only one. */
function timelineOf(entries: TimelineEntry[], duration: number): FlareTimeline {
  const snapshot = findSnapshot(entries);
  if (snapshot !== null) {
    for (const entry of entries) {
      if (entry === snapshot) continue;
      if (entry.start > snapshot.start + START_EPSILON) {
        throw new RangeError('ui-fx: nothing can follow a snapshot step');
      }
      if (isSnapshotPreset(entry.preset)) {
        throw new RangeError('ui-fx: a timeline takes one snapshot step at most');
      }
    }
  }
  return Object.freeze({ kind: 'timeline', entries: Object.freeze(entries), duration });
}

/** Items one after another: each starts when the one before it ends. */
export function sequence(...items: (FlarePreset | FlareTimeline)[]): FlareTimeline {
  const entries: TimelineEntry[] = [];
  let at = 0;
  for (const item of items) {
    pushAt(entries, item, at);
    at += durationOf(item);
  }
  return timelineOf(entries, at);
}

/** Items that all start together. The timeline lasts as long as the longest. */
export function parallel(...items: (FlarePreset | FlareTimeline)[]): FlareTimeline {
  return stagger(0, ...items);
}

/** Items that start `step` seconds apart. The timeline lasts until the latest end. */
export function stagger(step: number, ...items: (FlarePreset | FlareTimeline)[]): FlareTimeline {
  checkSeconds('stagger', 'step', step);
  const entries: TimelineEntry[] = [];
  let duration = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const at = i * step;
    pushAt(entries, item, at);
    duration = Math.max(duration, at + durationOf(item));
  }
  return timelineOf(entries, duration);
}

/** An empty stretch of `seconds`, for spacing the items of a `sequence`. */
export function delay(seconds: number): FlareTimeline {
  checkSeconds('delay', 'seconds', seconds);
  return timelineOf([], seconds);
}

/** The timeline's snapshot entry, or `null` when every entry is live. */
export function snapshotEntry(
  tl: FlareTimeline,
): TimelineEntry<SnapshotPreset & PresetCommon> | null {
  for (const entry of tl.entries) {
    const { preset } = entry;
    if (isSnapshotPreset(preset)) return { start: entry.start, preset };
  }
  return null;
}

/**
 * The live entries that start before the snapshot entry: every entry when the timeline has none.
 * A live entry that starts together with the snapshot entry is left out, since the view is hidden
 * from that moment.
 */
export function liveEntries(
  tl: FlareTimeline,
): readonly TimelineEntry<LivePreset & PresetCommon>[] {
  const snapshot = findSnapshot(tl.entries);
  const live: TimelineEntry<LivePreset & PresetCommon>[] = [];
  for (const entry of tl.entries) {
    const { preset } = entry;
    if (isSnapshotPreset(preset)) continue;
    if (snapshot !== null && entry.start >= snapshot.start - START_EPSILON) continue;
    live.push({ start: entry.start, preset });
  }
  return live;
}
