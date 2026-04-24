import type { ZoneId } from '../events';
import type { SlotData } from './schema';

export type SlotPreviewStatus = 'empty' | 'in-progress' | 'completed';

export interface SlotPreview {
  readonly index: number;
  readonly status: SlotPreviewStatus;
  readonly bestScore: number;
  readonly zoneReached: ZoneId;
  readonly lastPlayed: number;
  readonly runs: number;
}

/**
 * Pure derivation of what the save-select UI shows for one slot.
 * Tests assert structure; timestamp formatting is locale-dependent and
 * happens at the render layer via `Intl.DateTimeFormat`.
 */
export function slotPreview(index: number, slot: SlotData | null): SlotPreview {
  if (slot === null) {
    return {
      index,
      status: 'empty',
      bestScore: 0,
      zoneReached: 'z1',
      lastPlayed: 0,
      runs: 0,
    };
  }
  return {
    index,
    status: slot.bossDefeated ? 'completed' : 'in-progress',
    bestScore: slot.bestScore,
    zoneReached: slot.zoneReached,
    lastPlayed: slot.savedAt,
    runs: slot.runs,
  };
}

/**
 * Format a timestamp using `Intl.DateTimeFormat` against the save locale.
 * Returns an empty string for a zero timestamp (empty / unsaved slots).
 */
export function formatLastPlayed(ts: number, locale: 'en' | 'pl'): string {
  if (ts <= 0) return '';
  try {
    return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(ts));
  } catch {
    return '';
  }
}
