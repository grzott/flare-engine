import { describe, expect, test } from 'bun:test';
import { SCREEN_SPECS } from '../src/visual-spec';
import type { ScreenId } from '../src/visual-spec/types';

const ALL_SCREEN_IDS: readonly ScreenId[] = ['boot', 'menu', 'save-select', 'settings', 'credits'];

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

describe('vs-screens — exhaustiveness', () => {
  test('SCREEN_SPECS covers all 5 ScreenIds', () => {
    for (const id of ALL_SCREEN_IDS) {
      expect(SCREEN_SPECS[id], `screen: ${id}`).toBeDefined();
      expect(SCREEN_SPECS[id].id).toBe(id);
    }
    expect(Object.keys(SCREEN_SPECS).length).toBe(ALL_SCREEN_IDS.length);
  });

  test('each screen has at least one section', () => {
    for (const id of ALL_SCREEN_IDS) {
      expect(SCREEN_SPECS[id].sections.length, `${id}.sections`).toBeGreaterThan(0);
    }
  });
});

describe('vs-screens — background colors', () => {
  test('every sky is a valid hex', () => {
    const violations: string[] = [];
    for (const id of ALL_SCREEN_IDS) {
      const sky = SCREEN_SPECS[id].background.sky;
      if (!HEX_RE.test(sky)) violations.push(`${id}.sky = ${sky}`);
    }
    expect(violations).toEqual([]);
  });

  test('boot sky = #050A07 (void)', () => {
    expect(SCREEN_SPECS.boot.background.sky).toBe('#050A07');
  });

  test('menu / save-select / settings / credits sky = #0E1A12 (inkBlack)', () => {
    const inkBlack = '#0E1A12';
    expect(SCREEN_SPECS.menu.background.sky).toBe(inkBlack);
    expect(SCREEN_SPECS['save-select'].background.sky).toBe(inkBlack);
    expect(SCREEN_SPECS.settings.background.sky).toBe(inkBlack);
    expect(SCREEN_SPECS.credits.background.sky).toBe(inkBlack);
  });
});

describe('vs-screens — navigation', () => {
  test('boot navigation = none', () => {
    expect(SCREEN_SPECS.boot.navigation).toBe('none');
  });

  test('menu navigation = choices', () => {
    expect(SCREEN_SPECS.menu.navigation).toBe('choices');
  });

  test('save-select, settings, credits navigation = back', () => {
    expect(SCREEN_SPECS['save-select'].navigation).toBe('back');
    expect(SCREEN_SPECS.settings.navigation).toBe('back');
    expect(SCREEN_SPECS.credits.navigation).toBe('back');
  });
});

describe('vs-screens — section order integrity', () => {
  test('section order values are unique and contiguous from 0 in each screen', () => {
    for (const id of ALL_SCREEN_IDS) {
      const orders = SCREEN_SPECS[id].sections.map((s) => s.order).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        expect(orders[i], `${id}.sections[${i}].order`).toBe(i);
      }
    }
  });
});

describe('vs-screens — credits section count', () => {
  test('credits has 8 sections (title + 6 content + skip)', () => {
    expect(SCREEN_SPECS.credits.sections.length).toBe(8);
  });
});

describe('vs-screens — settings section count', () => {
  test('settings has 8 sections', () => {
    expect(SCREEN_SPECS.settings.sections.length).toBe(8);
  });
});
