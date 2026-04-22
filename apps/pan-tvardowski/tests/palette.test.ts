import { describe, expect, test } from 'bun:test';
import { ZONE_PALETTES, type ZoneId } from '../src/palette';

describe('zone palette', () => {
  test('all 8 zones present', () => {
    for (let i = 1; i <= 8; i++) {
      const id = i as ZoneId;
      expect(ZONE_PALETTES[id], `zone ${id}`).toBeDefined();
    }
  });

  test('channels are valid 32-bit ARGB with full alpha', () => {
    for (const zone of Object.values(ZONE_PALETTES)) {
      for (const channel of ['primary', 'accent', 'hazard'] as const) {
        const v = zone[channel];
        expect(Number.isInteger(v), `${zone.name}.${channel}`).toBe(true);
        expect(v >>> 0).toBe(v);
        // Alpha byte = 0xff.
        expect((v >>> 24) & 0xff).toBe(0xff);
      }
    }
  });

  test('primary, accent, hazard are distinct within a zone', () => {
    for (const zone of Object.values(ZONE_PALETTES)) {
      expect(zone.primary, `${zone.name}`).not.toBe(zone.accent);
      expect(zone.primary, `${zone.name}`).not.toBe(zone.hazard);
      expect(zone.accent, `${zone.name}`).not.toBe(zone.hazard);
    }
  });
});
