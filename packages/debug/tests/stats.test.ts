import { describe, expect, test } from 'bun:test';
import { StatsTracker } from '../src/stats.js';

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
