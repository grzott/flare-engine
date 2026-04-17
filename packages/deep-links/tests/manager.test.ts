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
        (listeners[t] ??= []).push(l);
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
});

describe('createNativeSource', () => {
  test('wires RN Linking-like object', async () => {
    let handler: ((e: { url: string }) => void) | null = null;
    let removed = false;
    const linking = {
      async getInitialURL() {
        return 'flare://home';
      },
      addEventListener(_t: 'url', h: (e: { url: string }) => void) {
        handler = h;
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
    handler?.({ url: '/new' });
    expect(seen).toEqual(['/new']);
    unsub();
    expect(removed).toBe(true);
  });
});
