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
});
