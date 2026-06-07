import { describe, expect, test } from 'bun:test';
import { MINIBOSS_BEHAVIORS } from '../src/systems/miniboss/behaviors';

describe('MINIBOSS_BEHAVIORS registry', () => {
  test('has exactly the 4 expected pattern keys', () => {
    const keys = Object.keys(MINIBOSS_BEHAVIORS).sort();
    expect(keys).toEqual(['leszy', 'madej', 'nocny-lowca', 'rokita']);
  });

  test('each entry has an onUpdate function', () => {
    for (const [, behavior] of Object.entries(MINIBOSS_BEHAVIORS)) {
      expect(typeof behavior.onUpdate).toBe('function');
    }
  });

  test('rokita has NO onActiveEnter', () => {
    expect(MINIBOSS_BEHAVIORS.rokita.onActiveEnter).toBeUndefined();
  });

  test('leszy has onActiveEnter', () => {
    expect(typeof MINIBOSS_BEHAVIORS.leszy.onActiveEnter).toBe('function');
  });

  test('nocny-lowca has onActiveEnter', () => {
    expect(typeof MINIBOSS_BEHAVIORS['nocny-lowca'].onActiveEnter).toBe('function');
  });

  test('madej has onActiveEnter', () => {
    expect(typeof MINIBOSS_BEHAVIORS.madej.onActiveEnter).toBe('function');
  });

  test('each pattern routes to a distinct behavior object', () => {
    const entries = Object.values(MINIBOSS_BEHAVIORS);
    const unique = new Set(entries);
    expect(unique.size).toBe(4);
  });
});
