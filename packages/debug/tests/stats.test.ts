import { describe, expect, test } from 'bun:test';
import { createStatsTracker, StatsTracker } from '../src/stats.js';

describe('createStatsTracker', () => {
  test('starts with zero stats', () => {
    const tracker = createStatsTracker();
    expect(tracker.stats).toEqual({
      fps: 0,
      rawDt: 0,
      dt: 0,
      frame: 0,
      entityCount: 0,
      drawCalls: 0,
    });
  });

  test('each setter writes only its own fields', () => {
    const tracker = createStatsTracker();
    tracker.updateFromClock(60, 0.02, 0.01, 42);
    expect(tracker.stats).toEqual({
      fps: 60,
      rawDt: 0.02,
      dt: 0.01,
      frame: 42,
      entityCount: 0,
      drawCalls: 0,
    });
    tracker.setEntityCount(150);
    tracker.setDrawCalls(8);
    expect(tracker.stats).toEqual({
      fps: 60,
      rawDt: 0.02,
      dt: 0.01,
      frame: 42,
      entityCount: 150,
      drawCalls: 8,
    });
  });

  test('reset clears every field', () => {
    const tracker = createStatsTracker();
    tracker.updateFromClock(60, 0.016, 0.016, 100);
    tracker.setEntityCount(50);
    tracker.setDrawCalls(4);
    tracker.reset();
    expect(tracker.stats).toEqual({
      fps: 0,
      rawDt: 0,
      dt: 0,
      frame: 0,
      entityCount: 0,
      drawCalls: 0,
    });
  });

  test('updates the same stats object in place', () => {
    const tracker = createStatsTracker();
    const snapshot = tracker.stats;
    tracker.updateFromClock(30, 0.033, 0.033, 1);
    tracker.setEntityCount(3);
    tracker.setDrawCalls(2);
    tracker.reset();
    expect(tracker.stats).toBe(snapshot);
  });

  test('two trackers do not share stats', () => {
    const a = createStatsTracker();
    const b = createStatsTracker();
    a.updateFromClock(60, 0.016, 0.016, 7);
    a.setEntityCount(9);
    expect(b.stats.fps).toBe(0);
    expect(b.stats.frame).toBe(0);
    expect(b.stats.entityCount).toBe(0);
    expect(a.stats).not.toBe(b.stats);
  });

  test('has the same members as the deprecated class and tracks it call for call', () => {
    const handle = createStatsTracker();
    const legacy = new StatsTracker();
    const methods = ['updateFromClock', 'setEntityCount', 'setDrawCalls', 'reset'] as const;
    for (const name of methods) expect(typeof handle[name]).toBe('function');
    expect(Object.keys(handle).sort()).toEqual([...methods, 'stats'].sort());

    handle.updateFromClock(59.5, 0.0168, 0.0084, 12);
    legacy.updateFromClock(59.5, 0.0168, 0.0084, 12);
    handle.setEntityCount(42);
    legacy.setEntityCount(42);
    handle.setDrawCalls(6);
    legacy.setDrawCalls(6);
    expect(handle.stats).toEqual(legacy.stats);
    handle.reset();
    legacy.reset();
    expect(handle.stats).toEqual(legacy.stats);
  });
});

describe('StatsTracker', () => {
  test('starts with zero stats', () => {
    const tracker = new StatsTracker();
    expect(tracker.stats.fps).toBe(0);
    expect(tracker.stats.rawDt).toBe(0);
    expect(tracker.stats.dt).toBe(0);
    expect(tracker.stats.frame).toBe(0);
    expect(tracker.stats.entityCount).toBe(0);
    expect(tracker.stats.drawCalls).toBe(0);
  });

  test('updateFromClock sets timing stats', () => {
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 0.0167, 0.0167, 42);
    expect(tracker.stats.fps).toBe(60);
    expect(tracker.stats.rawDt).toBe(0.0167);
    expect(tracker.stats.dt).toBe(0.0167);
    expect(tracker.stats.frame).toBe(42);
  });

  test('setEntityCount updates entity count', () => {
    const tracker = new StatsTracker();
    tracker.setEntityCount(150);
    expect(tracker.stats.entityCount).toBe(150);
  });

  test('setDrawCalls updates draw call count', () => {
    const tracker = new StatsTracker();
    tracker.setDrawCalls(8);
    expect(tracker.stats.drawCalls).toBe(8);
  });

  test('reset clears all stats', () => {
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 0.016, 0.016, 100);
    tracker.setEntityCount(50);
    tracker.setDrawCalls(4);
    tracker.reset();
    expect(tracker.stats.fps).toBe(0);
    expect(tracker.stats.rawDt).toBe(0);
    expect(tracker.stats.dt).toBe(0);
    expect(tracker.stats.frame).toBe(0);
    expect(tracker.stats.entityCount).toBe(0);
    expect(tracker.stats.drawCalls).toBe(0);
  });
});
