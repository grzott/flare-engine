import { describe, expect, test } from 'bun:test';
import enJson from '../locales/en.json';
import plJson from '../locales/pl.json';

describe('fresh-save empty-state UX keys', () => {
  test('codex fresh_save keys present in both locales', () => {
    const en = enJson as Record<string, string>;
    const pl = plJson as Record<string, string>;
    expect(en['codex.fresh_save.heading']).toBe('Codex empty');
    expect(pl['codex.fresh_save.heading']).toBe('Kodeks pusty');
    expect(en['codex.fresh_save.body']).toContain('{n');
    expect(pl['codex.fresh_save.body']).toContain('{n');
  });

  test('achievements fresh_save keys present in both locales', () => {
    const en = enJson as Record<string, string>;
    const pl = plJson as Record<string, string>;
    expect(en['achievements.fresh_save.heading']).toBe('No achievements yet');
    expect(pl['achievements.fresh_save.heading']).toBe('Brak osiągnięć');
    expect(en['achievements.fresh_save.body']).toContain('{n');
    expect(pl['achievements.fresh_save.body']).toContain('{n');
  });
});
