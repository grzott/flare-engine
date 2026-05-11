import { describe, expect, test } from 'bun:test';
import { SHIP_DEFS } from '../src/visual-spec/ships';

const HEX_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

describe('vs-ships', () => {
  test('SHIP_DEFS has 29 entries', () => {
    expect(SHIP_DEFS.length).toBe(29);
  });

  test('every ship has valid hex for hullColor, weaponColor, engineColor, exhaustColor', () => {
    const violations: string[] = [];
    for (const ship of SHIP_DEFS) {
      if (!HEX_RE.test(ship.hullColor)) violations.push(`${ship.id}.hullColor = ${ship.hullColor}`);
      if (!HEX_RE.test(ship.weaponColor))
        violations.push(`${ship.id}.weaponColor = ${ship.weaponColor}`);
      if (!HEX_RE.test(ship.engineColor))
        violations.push(`${ship.id}.engineColor = ${ship.engineColor}`);
      if (!HEX_RE.test(ship.exhaustColor))
        violations.push(`${ship.id}.exhaustColor = ${ship.exhaustColor}`);
      if (ship.hullStroke !== undefined && !HEX_RE.test(ship.hullStroke))
        violations.push(`${ship.id}.hullStroke = ${ship.hullStroke}`);
    }
    expect(violations).toEqual([]);
  });

  test('all 8 bosses have glow: hazard', () => {
    const bosses = SHIP_DEFS.filter((s) => s.weaponRatio === '1:12' && s.glow === 'hazard');
    expect(bosses.length).toBe(8);
  });

  test('all 3 player ships have glow: friendly', () => {
    const players = SHIP_DEFS.filter((s) => s.glow === 'friendly');
    expect(players.length).toBe(3);
  });

  test('every id is unique', () => {
    const ids = SHIP_DEFS.map((s) => s.id);
    expect(new Set(ids).size).toBe(SHIP_DEFS.length);
  });
});
