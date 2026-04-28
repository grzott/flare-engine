import { expect, test } from 'bun:test';
import { ANALYTICS_EVENTS, ANALYTICS_EVENT_COUNT } from '../src/tier2/analytics-events';

test('ANALYTICS_EVENTS has exactly ANALYTICS_EVENT_COUNT keys', () => {
  expect(Object.keys(ANALYTICS_EVENTS).length).toBe(ANALYTICS_EVENT_COUNT);
});

test('all 4 expected event names are present as values', () => {
  const values = Object.values(ANALYTICS_EVENTS);
  expect(values).toContain('zone_start');
  expect(values).toContain('zone_complete');
  expect(values).toContain('miniboss_defeated');
  expect(values).toContain('boss_phase_change');
});

test('ANALYTICS_EVENT_COUNT constant equals 4', () => {
  expect(ANALYTICS_EVENT_COUNT).toBe(4);
});
