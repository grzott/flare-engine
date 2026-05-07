import { describe, expect, test } from 'bun:test';
import { ANIMATION_DEFS, HUD_TWEENS } from '../src/visual-spec';

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

describe('vs-animations — ANIMATION_DEFS', () => {
  test('has exactly 5 entries with unique ids', () => {
    expect(ANIMATION_DEFS.length).toBe(5);
    const ids = ANIMATION_DEFS.map((a) => a.id);
    expect(new Set(ids).size).toBe(5);
  });

  test('shatter-3: fragments=3, direction=random, fxTier=detonation', () => {
    const def = ANIMATION_DEFS.find((a) => a.id === 'shatter-3');
    expect(def).toBeDefined();
    if (def?.id !== 'shatter-3') return;
    expect(def.fragments).toBe(3);
    expect(def.direction).toBe('random');
    expect(def.fxTier).toBe('detonation');
  });

  test('exhaust-pulse: hz=6, minOpacity=0.4, maxOpacity=1.0', () => {
    const def = ANIMATION_DEFS.find((a) => a.id === 'exhaust-pulse');
    expect(def).toBeDefined();
    if (def?.id !== 'exhaust-pulse') return;
    expect(def.hz).toBe(6);
    expect(def.minOpacity).toBe(0.4);
    expect(def.maxOpacity).toBe(1.0);
  });

  test('muzzle-flash: durationMs=80, color valid hex, r=6', () => {
    const def = ANIMATION_DEFS.find((a) => a.id === 'muzzle-flash');
    expect(def).toBeDefined();
    if (def?.id !== 'muzzle-flash') return;
    expect(def.durationMs).toBe(80);
    expect(HEX_RE.test(def.color)).toBe(true);
    expect(def.r).toBe(6);
  });

  test('rocket-trail: emitRate=30, color valid hex, lifetimeMs=400', () => {
    const def = ANIMATION_DEFS.find((a) => a.id === 'rocket-trail');
    expect(def).toBeDefined();
    if (def?.id !== 'rocket-trail') return;
    expect(def.emitRate).toBe(30);
    expect(HEX_RE.test(def.color)).toBe(true);
    expect(def.lifetimeMs).toBe(400);
  });

  test('spiral-collapse (★ placeholder): turns=3, durationMs=1200', () => {
    const def = ANIMATION_DEFS.find((a) => a.id === 'spiral-collapse');
    expect(def).toBeDefined();
    if (def?.id !== 'spiral-collapse') return;
    expect(def.turns).toBe(3);
    expect(def.durationMs).toBe(1200);
  });
});

describe('vs-animations — HUD_TWEENS', () => {
  test('has exactly 4 tween entries with unique ids', () => {
    expect(HUD_TWEENS.length).toBe(4);
    const ids = HUD_TWEENS.map((t) => t.id);
    expect(new Set(ids).size).toBe(4);
  });

  test('zone-banner-fade-in: from=0, to=1, durationSec=0.8, easing=easeOutQuart', () => {
    const t = HUD_TWEENS.find((h) => h.id === 'zone-banner-fade-in');
    expect(t).toBeDefined();
    expect(t?.from).toBe(0);
    expect(t?.to).toBe(1);
    expect(t?.durationSec).toBe(0.8);
    expect(t?.easingName).toBe('easeOutQuart');
  });

  test('zone-banner-fade-out: durationSec=0.45, easing=easeOutQuart', () => {
    const t = HUD_TWEENS.find((h) => h.id === 'zone-banner-fade-out');
    expect(t?.durationSec).toBe(0.45);
    expect(t?.easingName).toBe('easeOutQuart');
  });

  test('zone-banner-hold: from=1, to=1, durationSec=1.4', () => {
    const t = HUD_TWEENS.find((h) => h.id === 'zone-banner-hold');
    expect(t?.from).toBe(1);
    expect(t?.to).toBe(1);
    expect(t?.durationSec).toBe(1.4);
  });

  test('combo-pulse: from=1, to=1.18, durationSec=0.12, easing=easeOutBack', () => {
    const t = HUD_TWEENS.find((h) => h.id === 'combo-pulse');
    expect(t?.from).toBe(1);
    expect(t?.to).toBe(1.18);
    expect(t?.durationSec).toBe(0.12);
    expect(t?.easingName).toBe('easeOutBack');
  });

  test('all easing names are non-empty strings', () => {
    for (const t of HUD_TWEENS) {
      expect(typeof t.easingName).toBe('string');
      expect(t.easingName.length).toBeGreaterThan(0);
    }
  });
});
