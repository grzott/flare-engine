import { describe, expect, it } from 'bun:test';
import en from '../locales/en.json' with { type: 'json' };
import pl from '../locales/pl.json' with { type: 'json' };

const GROUP_KEYS = [
  'settings.group.audio',
  'settings.group.accessibility',
  'settings.group.gameplay',
  'settings.group.telemetry',
] as const;

describe('settings screen — session #81 M3', () => {
  it('all 4 group keys are non-empty in EN', () => {
    for (const key of GROUP_KEYS) {
      const value = (en as Record<string, string | undefined>)[key];
      expect(value).toBeTruthy();
      expect((value ?? '').length).toBeGreaterThan(0);
    }
  });

  it('all 4 group keys are non-empty in PL', () => {
    for (const key of GROUP_KEYS) {
      const value = (pl as Record<string, string | undefined>)[key];
      expect(value).toBeTruthy();
      expect((value ?? '').length).toBeGreaterThan(0);
    }
  });

  it('group order is audio → accessibility → gameplay → telemetry in keys array', () => {
    expect(GROUP_KEYS[0]).toBe('settings.group.audio');
    expect(GROUP_KEYS[1]).toBe('settings.group.accessibility');
    expect(GROUP_KEYS[2]).toBe('settings.group.gameplay');
    expect(GROUP_KEYS[3]).toBe('settings.group.telemetry');
  });
});
