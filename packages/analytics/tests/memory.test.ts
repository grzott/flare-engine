import { describe, expect, test } from 'bun:test';
import { createConsoleAnalytics, createMemoryAnalytics } from '../src/memory.js';
import type { AnalyticsEvent } from '../src/provider.js';

function counterNow(): () => number {
  let n = 0;
  return () => ++n;
}

describe('createMemoryAnalytics', () => {
  test('captures track/identify/screen in order with correct shape', async () => {
    const mem = createMemoryAnalytics({ now: counterNow() });
    await mem.track('a', { k: 1 });
    await mem.identify('u', { plan: 'pro' });
    await mem.screen('s');

    const events = mem.getEvents();
    expect(events).toHaveLength(3);

    const [first, second, third] = events;
    expect(first).toEqual({ type: 'track', name: 'a', props: { k: 1 }, timestamp: 1 });
    expect(second).toEqual({
      type: 'identify',
      userId: 'u',
      traits: { plan: 'pro' },
      timestamp: 2,
    });
    expect(third).toEqual({ type: 'screen', name: 's', timestamp: 3 });

    if (first?.type !== 'track') throw new Error('expected track event');
    expect(first.props).toEqual({ k: 1 });
  });

  test('omits props/traits when the arg is undefined', async () => {
    const mem = createMemoryAnalytics({ now: counterNow() });
    await mem.track('a');
    await mem.identify('u');
    await mem.screen('s');

    const events = mem.getEvents();
    for (const event of events) {
      expect(Object.hasOwn(event, 'props')).toBe(false);
      expect(Object.hasOwn(event, 'traits')).toBe(false);
    }
  });

  test('ring buffer drops the oldest event over capacity', async () => {
    const mem = createMemoryAnalytics({ capacity: 2, now: counterNow() });
    await mem.track('a');
    await mem.track('b');
    await mem.track('c');

    const events = mem.getEvents();
    expect(events).toHaveLength(2);
    expect(events.map((e) => (e.type === 'track' ? e.name : ''))).toEqual(['b', 'c']);
    expect(events.map((e) => e.timestamp)).toEqual([2, 3]);
  });

  test('capacity smaller than 1 is clamped to 1', async () => {
    const mem = createMemoryAnalytics({ capacity: 0, now: counterNow() });
    await mem.track('a');
    await mem.track('b');

    const events = mem.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'track', name: 'b', timestamp: 2 });
  });

  test('clear empties the buffer', async () => {
    const mem = createMemoryAnalytics({ now: counterNow() });
    await mem.track('a');
    await mem.track('b');
    mem.clear();
    expect(mem.getEvents()).toHaveLength(0);
  });

  test('getEvents returns a defensive copy', async () => {
    const mem = createMemoryAnalytics({ now: counterNow() });
    await mem.track('a');

    const snapshot = mem.getEvents() as AnalyticsEvent[];
    snapshot.push({ type: 'track', name: 'injected', timestamp: 999 });
    snapshot.length = 0;

    expect(mem.getEvents()).toHaveLength(1);
    expect(mem.getEvents()[0]).toEqual({ type: 'track', name: 'a', timestamp: 1 });
  });

  test('flush resolves without throwing', async () => {
    const mem = createMemoryAnalytics();
    expect(await mem.flush()).toBeUndefined();
  });
});

describe('createConsoleAnalytics', () => {
  test('logs each captured event to the injected sink', async () => {
    const calls: unknown[][] = [];
    const provider = createConsoleAnalytics({
      log: (...args: unknown[]) => {
        calls.push(args);
      },
      now: counterNow(),
    });

    await provider.track('x');

    expect(calls).toHaveLength(1);
    const [label, event] = calls[0] as [unknown, AnalyticsEvent];
    expect(label).toBe('[analytics]');
    expect(event.type).toBe('track');
    if (event.type !== 'track') throw new Error('expected track event');
    expect(event.name).toBe('x');
    expect(event.timestamp).toBe(1);
  });
});
