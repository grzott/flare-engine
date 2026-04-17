import { describe, expect, test } from 'bun:test';
import { darkTheme, lightTheme } from '../src/theme.js';

describe('theme tokens', () => {
  test('darkTheme and lightTheme share the same token shape', () => {
    expect(Object.keys(darkTheme.colors).sort()).toEqual(Object.keys(lightTheme.colors).sort());
    expect(Object.keys(darkTheme.spacing).sort()).toEqual(Object.keys(lightTheme.spacing).sort());
    expect(Object.keys(darkTheme.radii).sort()).toEqual(Object.keys(lightTheme.radii).sort());
    expect(Object.keys(darkTheme.typography).sort()).toEqual(
      Object.keys(lightTheme.typography).sort(),
    );
  });

  test('spacing scale is monotonically increasing', () => {
    const { xs, sm, md, lg, xl } = darkTheme.spacing;
    expect(xs).toBeLessThan(sm);
    expect(sm).toBeLessThan(md);
    expect(md).toBeLessThan(lg);
    expect(lg).toBeLessThan(xl);
  });

  test('pill radius is large enough to fully round typical controls', () => {
    expect(darkTheme.radii.pill).toBeGreaterThanOrEqual(999);
  });

  test('theme names are distinct', () => {
    expect(darkTheme.name).toBe('dark');
    expect(lightTheme.name).toBe('light');
  });
});
