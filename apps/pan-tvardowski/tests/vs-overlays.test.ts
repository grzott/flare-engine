import { describe, expect, test } from 'bun:test';
import { OVERLAY_SPECS } from '../src/visual-spec';
import type { OverlayId } from '../src/visual-spec/types';

const ALL_OVERLAY_IDS: readonly OverlayId[] = [
  'inventory',
  'codex-shards',
  'achievements',
  'shop',
  'pause',
  'dialogue',
  'paywall',
  'privacy',
  'boot',
  'menu',
];

describe('vs-overlays — exhaustiveness', () => {
  test('OVERLAY_SPECS covers all 10 OverlayIds', () => {
    for (const id of ALL_OVERLAY_IDS) {
      expect(OVERLAY_SPECS[id], `overlay: ${id}`).toBeDefined();
      expect(OVERLAY_SPECS[id].id).toBe(id);
    }
    expect(Object.keys(OVERLAY_SPECS).length).toBe(ALL_OVERLAY_IDS.length);
  });

  test('each overlay has at least one section', () => {
    for (const id of ALL_OVERLAY_IDS) {
      expect(OVERLAY_SPECS[id].sections.length, `${id}.sections`).toBeGreaterThan(0);
    }
  });

  test('section order values are unique and >= 0 within each overlay', () => {
    for (const id of ALL_OVERLAY_IDS) {
      const orders = OVERLAY_SPECS[id].sections.map((s) => s.order);
      const unique = new Set(orders);
      expect(unique.size, `${id} has duplicate orders`).toBe(orders.length);
      for (const o of orders) {
        expect(o, `${id} section order < 0`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('vs-overlays — panel sizes', () => {
  test('inventory, codex-shards, achievements, shop, boot, menu = panel lg', () => {
    const lgOverlays: OverlayId[] = [
      'inventory',
      'codex-shards',
      'achievements',
      'shop',
      'boot',
      'menu',
    ];
    for (const id of lgOverlays) {
      expect(OVERLAY_SPECS[id].panel, `${id}.panel`).toBe('lg');
    }
  });

  test('pause = panel md', () => {
    expect(OVERLAY_SPECS.pause.panel).toBe('md');
  });

  test('dialogue = panel md, backdropAlpha = 0', () => {
    expect(OVERLAY_SPECS.dialogue.panel).toBe('md');
    expect(OVERLAY_SPECS.dialogue.backdropAlpha).toBe(0);
  });
});

describe('vs-overlays — close buttons', () => {
  test('pause.closeButton = top-right', () => {
    expect(OVERLAY_SPECS.pause.closeButton).toBe('top-right');
  });

  test('paywall.closeButton = top-right', () => {
    expect(OVERLAY_SPECS.paywall.closeButton).toBe('top-right');
  });

  test('inventory, codex-shards, achievements closeButton = none', () => {
    expect(OVERLAY_SPECS.inventory.closeButton).toBe('none');
    expect(OVERLAY_SPECS['codex-shards'].closeButton).toBe('none');
    expect(OVERLAY_SPECS.achievements.closeButton).toBe('none');
  });
});

describe('vs-overlays — placeholder flags', () => {
  test('pause has a single placeholder section with unimplemented note', () => {
    const { sections } = OVERLAY_SPECS.pause;
    expect(sections.length).toBe(1);
    expect(sections[0]?.id).toBe('pause-placeholder');
    expect(sections[0]?.notes).toContain('unimplemented');
  });

  test('boot overlay notes flag it as a placeholder (schema overlap)', () => {
    const spec = OVERLAY_SPECS.boot as typeof OVERLAY_SPECS.boot & { notes?: string };
    expect(spec.notes).toContain('PLACEHOLDER');
    expect(spec.notes).toContain('ScreenId');
  });

  test('menu overlay notes flag schema overlap with ScreenId', () => {
    const spec = OVERLAY_SPECS.menu as typeof OVERLAY_SPECS.menu & { notes?: string };
    expect(spec.notes).toContain('PLACEHOLDER');
    expect(spec.notes).toContain('ScreenId');
  });
});

describe('vs-overlays — section ids unique within overlay', () => {
  test('no duplicate section ids within any overlay', () => {
    for (const id of ALL_OVERLAY_IDS) {
      const sectionIds = OVERLAY_SPECS[id].sections.map((s) => s.id);
      expect(new Set(sectionIds).size, `${id} has duplicate section ids`).toBe(sectionIds.length);
    }
  });
});
