import { describe, expect, test } from 'bun:test';
import { formatLastPlayed, slotPreview } from '../src/save/preview';
import { createSlot, mergeRun } from '../src/save/schema';

describe('save-select preview', () => {
  test('null slot → empty status, zone z1, zero best score', () => {
    const p = slotPreview(0, null);
    expect(p.index).toBe(0);
    expect(p.status).toBe('empty');
    expect(p.bestScore).toBe(0);
    expect(p.zoneReached).toBe('z1');
    expect(p.runs).toBe(0);
    expect(p.lastPlayed).toBe(0);
  });

  test('in-progress slot (no boss defeated yet)', () => {
    const slot = mergeRun(createSlot(1), 1200, false, 'z3');
    const p = slotPreview(1, slot);
    expect(p.status).toBe('in-progress');
    expect(p.bestScore).toBe(1200);
    expect(p.zoneReached).toBe('z3');
    expect(p.runs).toBe(1);
  });

  test('completed slot (victory run)', () => {
    const s1 = mergeRun(createSlot(2), 900, false, 'z5');
    const s2 = mergeRun(s1, 2500, true, 'z8');
    const p = slotPreview(2, s2);
    expect(p.status).toBe('completed');
    expect(p.bestScore).toBe(2500);
    expect(p.zoneReached).toBe('z8');
    expect(p.runs).toBe(2);
  });

  test('formatLastPlayed returns empty string for zero timestamp', () => {
    expect(formatLastPlayed(0, 'en')).toBe('');
    expect(formatLastPlayed(0, 'pl')).toBe('');
  });

  test('formatLastPlayed returns non-empty for real timestamps', () => {
    const ts = Date.UTC(2026, 3, 24, 12, 30);
    expect(formatLastPlayed(ts, 'en').length).toBeGreaterThan(0);
    expect(formatLastPlayed(ts, 'pl').length).toBeGreaterThan(0);
  });
});
