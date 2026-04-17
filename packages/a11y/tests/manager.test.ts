import { describe, expect, test } from 'bun:test';
import { A11yManager } from '../src/manager.js';

describe('A11yManager', () => {
  test('defaults', () => {
    const m = new A11yManager();
    expect(m.reducedMotion).toBe(false);
    expect(m.contrast).toBe('normal');
    expect(m.uiScale).toBe(1);
  });

  test('accepts initial overrides', () => {
    const m = new A11yManager({ initial: { reducedMotion: true, uiScale: 1.25 } });
    expect(m.reducedMotion).toBe(true);
    expect(m.uiScale).toBe(1.25);
  });

  test('onChange fires only on real diff', () => {
    const m = new A11yManager();
    const log: number[] = [];
    m.onChange.add(() => log.push(1));
    m.setReducedMotion(false);
    m.setReducedMotion(true);
    m.setReducedMotion(true);
    m.setContrast('high');
    m.setUiScale(1.5);
    expect(log.length).toBe(3);
  });

  test('update with partial patch merges', () => {
    const m = new A11yManager();
    m.update({ reducedMotion: true });
    expect(m.reducedMotion).toBe(true);
    expect(m.contrast).toBe('normal');
  });

  test('settings snapshot is replaced, not mutated', () => {
    const m = new A11yManager();
    const before = m.settings;
    m.setContrast('high');
    const after = m.settings;
    expect(before).not.toBe(after);
    expect(before.contrast).toBe('normal');
    expect(after.contrast).toBe('high');
  });
});
