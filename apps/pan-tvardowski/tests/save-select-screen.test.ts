import { describe, expect, it } from 'bun:test';
import enJson from '../locales/en.json';
import plJson from '../locales/pl.json';

describe('save-select screen — folio X locale keys', () => {
  it('menu.save_select.new_game present in EN and PL', () => {
    const en = enJson as Record<string, string>;
    const pl = plJson as Record<string, string>;
    expect(en['menu.save_select.new_game']).toBe('New Game');
    expect(pl['menu.save_select.new_game']).toBe('Nowa Gra');
  });

  it('menu.save_select.runs present in EN and PL', () => {
    const en = enJson as Record<string, string>;
    const pl = plJson as Record<string, string>;
    expect(en['menu.save_select.runs']).toContain('{count}');
    expect(pl['menu.save_select.runs']).toContain('{count}');
  });
});
