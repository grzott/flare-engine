import { describe, expect, test } from 'bun:test';
import { DeepLinkManager } from '../src/manager.js';
import { DeepLinkRouter } from '../src/router.js';
import { createMemorySource, createNativeSource, createWebSource } from '../src/sources.js';

describe('DeepLinkManager', () => {
  test('initial URL is matched on start', async () => {
    const router = new DeepLinkRouter().register('/bench/:id', 'bench');
    const src = createMemorySource('/bench/7');
    const mgr = new DeepLinkManager({ router, source: src });
    const matches: string[] = [];
    mgr.onMatch.add((m) => matches.push(m.scene));
    await mgr.start();
    expect(matches).toEqual(['bench']);
    expect(mgr.current?.params.id).toBe('7');
  });

  test('unmatched URLs emit onUnmatched', async () => {
    const router = new DeepLinkRouter().register('/known', 'known');
    const src = createMemorySource();
    const mgr = new DeepLinkManager({ router, source: src });
    const log: string[] = [];
    mgr.onUnmatched.add((u) => log.push(u));
    await mgr.start();
    src.push('/nope');
    expect(log).toEqual(['/nope']);
    expect(mgr.current).toBeNull();
  });

  test('stop removes the subscription', async () => {
    const router = new DeepLinkRouter().register('/a', 'a');
    const src = createMemorySource();
    const mgr = new DeepLinkManager({ router, source: src });
    let hits = 0;
    mgr.onMatch.add(() => hits++);
    await mgr.start();
    src.push('/a');
    mgr.stop();
    src.push('/a');
    expect(hits).toBe(1);
  });
});

describe('createWebSource', () => {
  test('bridges popstate + location.href', () => {
    const listeners: Record<string, Array<() => void>> = {};
    const win = {
      location: { href: '/init' },
      addEventListener: (t: string, l: () => void) => {
        const bucket = listeners[t] ?? [];
        bucket.push(l);
        listeners[t] = bucket;
      },
      removeEventListener: (t: string, l: () => void) => {
        listeners[t] = (listeners[t] ?? []).filter((x) => x !== l);
      },
    };
    const src = createWebSource(win);
    expect(src.getInitialUrl()).toBe('/init');
    const seen: string[] = [];
    const unsub = src.subscribe((u) => seen.push(u));
    win.location.href = '/next';
    for (const fn of listeners.popstate ?? []) fn();
    expect(seen).toEqual(['/next']);
    src.notify('/manual');
    expect(seen).toEqual(['/next', '/manual']);
    unsub();
    expect(listeners.popstate?.length ?? 0).toBe(0);
  });

  // DOM-faithful window: addEventListener dedupes identical (type, listener)
  // pairs and removeEventListener drops the single registration, matching the
  // real browser (the mock above intentionally allows duplicates).
  function makeDomFaithfulWindow(initialHref: string) {
    const buckets = new Map<string, Set<() => void>>();
    const win = {
      location: { href: initialHref },
      addEventListener: (t: string, l: () => void) => {
        const bucket = buckets.get(t) ?? new Set<() => void>();
        bucket.add(l);
        buckets.set(t, bucket);
      },
      removeEventListener: (t: string, l: () => void) => {
        buckets.get(t)?.delete(l);
      },
    };
    const firePopstate = () => {
      for (const fn of [...(buckets.get('popstate') ?? [])]) fn();
    };
    return { win, firePopstate };
  }

  test('one unsubscribe keeps popstate live for the remaining subscriber', () => {
    const { win, firePopstate } = makeDomFaithfulWindow('/init');
    const src = createWebSource(win);
    const a: string[] = [];
    const b: string[] = [];
    const unsubA = src.subscribe((u) => a.push(u));
    src.subscribe((u) => b.push(u));

    win.location.href = '/one';
    firePopstate();
    expect(a).toEqual(['/one']);
    expect(b).toEqual(['/one']);

    unsubA();
    win.location.href = '/two';
    firePopstate();
    // A stopped; B must keep receiving (the shared-listener bug dropped B too).
    expect(a).toEqual(['/one']);
    expect(b).toEqual(['/one', '/two']);
  });

  test('a subscribe during popstate dispatch does not receive that dispatch', () => {
    const { win, firePopstate } = makeDomFaithfulWindow('/init');
    const src = createWebSource(win);
    const seen: string[] = [];
    let addedLate = false;
    src.subscribe((u) => {
      seen.push(`early:${u}`);
      if (!addedLate) {
        addedLate = true;
        src.subscribe((u2) => seen.push(`late:${u2}`));
      }
    });

    win.location.href = '/x';
    firePopstate();
    // late handler was added mid-dispatch — it must not see '/x'.
    expect(seen).toEqual(['early:/x']);

    win.location.href = '/y';
    firePopstate();
    expect(seen).toEqual(['early:/x', 'early:/y', 'late:/y']);
  });
});

describe('createNativeSource', () => {
  test('wires RN Linking-like object', async () => {
    const capture: { handler: ((e: { url: string }) => void) | null } = { handler: null };
    let removed = false;
    const linking = {
      async getInitialURL() {
        return 'flare://home';
      },
      addEventListener(_t: 'url', h: (e: { url: string }) => void) {
        capture.handler = h;
        return {
          remove() {
            removed = true;
          },
        };
      },
    };
    const src = createNativeSource(linking);
    expect(await src.getInitialUrl()).toBe('flare://home');
    const seen: string[] = [];
    const unsub = src.subscribe((u) => seen.push(u));
    capture.handler?.({ url: '/new' });
    expect(seen).toEqual(['/new']);
    unsub();
    expect(removed).toBe(true);
  });
});
