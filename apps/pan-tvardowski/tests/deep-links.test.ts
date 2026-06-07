import { describe, expect, test } from 'bun:test';
import { createMemorySource, createPanTvardowskiDeepLinks } from '../src/deep-links/router';
import type { ZoneId } from '../src/events';

describe('deep links', () => {
  test('/zone/1 → z1', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/1');
    expect(requested).toEqual(['z1']);
  });

  test('/zone/2 → z2', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/2');
    expect(requested).toEqual(['z2']);
  });

  test('/zone/3 → z3', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/3');
    expect(requested).toEqual(['z3']);
  });

  test('/zone/4 → z4', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/4');
    expect(requested).toEqual(['z4']);
  });

  test('/zone/5 → z5', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/5');
    expect(requested).toEqual(['z5']);
  });

  test('/zone/6 → z6', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/6');
    expect(requested).toEqual(['z6']);
  });

  test('/zone/7 → z7', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/7');
    expect(requested).toEqual(['z7']);
  });

  test('/zone/8 → z8', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
    });
    await manager.start();
    source.push('pantvardowski://zone/8');
    expect(requested).toEqual(['z8']);
  });

  test('/zone/9 falls through to onUnmatched', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const unmatched: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
      onUnmatched: (url) => unmatched.push(url),
    });
    await manager.start();
    source.push('pantvardowski://zone/9');
    expect(requested).toEqual([]);
    expect(unmatched.length).toBeGreaterThan(0);
  });

  test('bench dispatch calls onBenchRequest with scenario id', async () => {
    const source = createMemorySource();
    const scenarios: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: () => {},
      onBenchRequest: (id) => scenarios.push(id),
    });
    await manager.start();
    source.push('pantvardowski://bench/bullet-storm');
    expect(scenarios).toEqual(['bullet-storm']);
  });

  test('scheme-less URL does not dispatch zone or bench', async () => {
    const source = createMemorySource();
    const requested: ZoneId[] = [];
    const scenarios: string[] = [];
    const unmatched: string[] = [];
    const manager = createPanTvardowskiDeepLinks(source, {
      onZoneRequest: (zone) => requested.push(zone),
      onBenchRequest: (id) => scenarios.push(id),
      onUnmatched: (url) => unmatched.push(url),
    });
    await manager.start();
    source.push('zone/1');
    expect(requested).toEqual([]);
    expect(scenarios).toEqual([]);
    expect(unmatched.length).toBeGreaterThan(0);
  });
});
