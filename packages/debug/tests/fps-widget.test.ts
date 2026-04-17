import { describe, expect, test } from 'bun:test';
import { createFpsWidget } from '../src/fps-widget.js';
import { StatsTracker } from '../src/stats.js';

describe('FpsWidget', () => {
  test('update formats compact one-line summary from stats', () => {
    const widget = createFpsWidget();
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 1 / 60, 1 / 60, 123);
    tracker.setEntityCount(42);
    tracker.setDrawCalls(8);
    widget.update(tracker.stats);
    expect(widget.line).toBe('60 FPS | 16.7ms | e:42 d:8');
  });

  test('rounds fps and rounds dt to configurable precision', () => {
    const widget = createFpsWidget({ msPrecision: 2 });
    const tracker = new StatsTracker();
    tracker.updateFromClock(59.4, 0.01678, 0.01678, 1);
    widget.update(tracker.stats);
    expect(widget.line.startsWith('59 FPS | 16.78ms')).toBe(true);
  });

  test('optional flags suppress entity / draw call segments', () => {
    const widget = createFpsWidget({ showEntities: false, showDrawCalls: false });
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 1 / 60, 1 / 60, 1);
    tracker.setEntityCount(999);
    tracker.setDrawCalls(999);
    widget.update(tracker.stats);
    expect(widget.line).toBe('60 FPS | 16.7ms');
  });

  test('multi-line breakdown exposes every stat', () => {
    const widget = createFpsWidget();
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 1 / 60, 1 / 60, 7);
    tracker.setEntityCount(3);
    tracker.setDrawCalls(2);
    widget.update(tracker.stats);
    expect(widget.lines).toEqual(['FPS: 60', 'dt: 16.7ms', 'frame: 7', 'entities: 3', 'draws: 2']);
  });

  test('lines array is reused across updates (no alloc per frame)', () => {
    const widget = createFpsWidget();
    const first = widget.lines;
    const tracker = new StatsTracker();
    tracker.updateFromClock(60, 1 / 60, 1 / 60, 1);
    widget.update(tracker.stats);
    widget.update(tracker.stats);
    expect(widget.lines).toBe(first);
  });
});
