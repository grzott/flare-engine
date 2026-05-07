import { describe, expect, test } from 'bun:test';
import { HUD_SPEC } from '../src/visual-spec';
import type { HudSlotId } from '../src/visual-spec/types';

const ALL_SLOT_IDS: readonly HudSlotId[] = [
  'score',
  'combo',
  'hp-bar',
  'weapon-meter',
  'bombs',
  'boss-bar',
  'miniboss-bar',
  'zone-banner',
];

describe('vs-hud — slot count and ids', () => {
  test('HUD_SPEC has exactly 8 slots', () => {
    expect(HUD_SPEC.slots.length).toBe(8);
  });

  test('all 8 HudSlotIds present exactly once', () => {
    const ids = new Set(HUD_SPEC.slots.map((s) => s.id));
    for (const id of ALL_SLOT_IDS) {
      expect(ids, `slot: ${id}`).toContain(id);
    }
    expect(ids.size).toBe(8);
  });
});

describe('vs-hud — anchors', () => {
  test('score: anchor=top-left, inset.dx=16, inset.dy=32', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'score');
    expect(s?.anchor).toBe('top-left');
    expect(s?.inset?.dx).toBe(16);
    expect(s?.inset?.dy).toBe(32);
  });

  test('boss-bar: anchor=top-center, inset.dy=32', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'boss-bar');
    expect(s?.anchor).toBe('top-center');
    expect(s?.inset?.dy).toBe(32);
  });

  test('miniboss-bar: anchor=top-center, inset.dy=56 (not 52)', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'miniboss-bar');
    expect(s?.anchor).toBe('top-center');
    expect(s?.inset?.dy).toBe(56);
  });

  test('zone-banner: anchor=mid-center, no inset (percentage top unrepresentable)', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'zone-banner');
    expect(s?.anchor).toBe('mid-center');
  });
});

describe('vs-hud — colors', () => {
  const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

  test('every defined fg/bg is a valid hex', () => {
    const violations: string[] = [];
    for (const slot of HUD_SPEC.slots) {
      if (slot.fg && !HEX_RE.test(slot.fg)) violations.push(`${slot.id}.fg = ${slot.fg}`);
      if (slot.bg && !HEX_RE.test(slot.bg)) violations.push(`${slot.id}.bg = ${slot.bg}`);
    }
    expect(violations).toEqual([]);
  });

  test('score fg = #C9A24A (gold)', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'score');
    expect(s?.fg).toBe('#C9A24A');
  });

  test('boss-bar fg = #E84B2A (hazard), bg = #C9A24A (gold border)', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'boss-bar');
    expect(s?.fg).toBe('#E84B2A');
    expect(s?.bg).toBe('#C9A24A');
  });
});

describe('vs-hud — type tokens', () => {
  test('score type = bodyL', () => {
    expect(HUD_SPEC.slots.find((s) => s.id === 'score')?.type).toBe('bodyL');
  });

  test('combo type = monoHud', () => {
    expect(HUD_SPEC.slots.find((s) => s.id === 'combo')?.type).toBe('monoHud');
  });

  test('miniboss-bar type = smallcap', () => {
    expect(HUD_SPEC.slots.find((s) => s.id === 'miniboss-bar')?.type).toBe('smallcap');
  });
});

describe('vs-hud — notes', () => {
  test('miniboss-bar notes mentions the 4 px discrepancy', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'miniboss-bar');
    expect(s?.notes).toContain('52');
    expect(s?.notes).toContain('56');
  });

  test('zone-banner notes mentions percentage schema limitation', () => {
    const s = HUD_SPEC.slots.find((sl) => sl.id === 'zone-banner');
    expect(s?.notes).toContain('38%');
  });
});
