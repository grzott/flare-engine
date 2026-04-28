import { expect, test } from 'bun:test';
import appJson from '../app.json';

test('expo.scheme is pantvardowski', () => {
  expect(appJson.expo.scheme).toBe('pantvardowski');
});

test('expo.android.intentFilters has at least one entry with correct scheme', () => {
  const filters = appJson.expo.android.intentFilters;
  expect(Array.isArray(filters)).toBe(true);
  expect(filters.length).toBeGreaterThanOrEqual(1);
  const first = filters[0];
  if (first === undefined) throw new Error('intentFilters[0] is undefined');
  const firstData = first.data[0];
  if (firstData === undefined) throw new Error('intentFilters[0].data[0] is undefined');
  expect(firstData.scheme).toBe('pantvardowski');
});

test('first intent filter has both BROWSABLE and DEFAULT categories', () => {
  const first = appJson.expo.android.intentFilters[0];
  if (first === undefined) throw new Error('intentFilters[0] is undefined');
  expect(first.category).toContain('BROWSABLE');
  expect(first.category).toContain('DEFAULT');
});
