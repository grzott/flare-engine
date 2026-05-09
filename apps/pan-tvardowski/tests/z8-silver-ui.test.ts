import { describe, expect, test } from 'bun:test';
import { ZONE_PALETTES, getUiPrimary, getUiPrimaryHex } from '../src/visual-spec/zones-palette';

describe('z8 silver UI', () => {
  test('getUiPrimary("z8") returns bone/silver ARGB', () => {
    expect(getUiPrimary('z8')).toBe(0xffc7b89a);
  });

  test('getUiPrimary("z1") returns gold ARGB', () => {
    expect(getUiPrimary('z1')).toBe(0xffc9a24a);
  });

  test('ZONE_PALETTES[8].silverUi is true and ZONE_PALETTES[1].silverUi is undefined', () => {
    expect(ZONE_PALETTES[8].silverUi).toBe(true);
    expect(ZONE_PALETTES[1].silverUi).toBeUndefined();
  });

  test('getUiPrimaryHex("z8") returns bone hex string', () => {
    expect(getUiPrimaryHex('z8')).toBe('#c7b89a');
  });

  test('getUiPrimaryHex("z1") returns gold hex string', () => {
    expect(getUiPrimaryHex('z1')).toBe('#c9a24a');
  });
});
