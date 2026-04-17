import { describe, expect, test } from 'bun:test';
import {
  ShareManager,
  createNativeShareTransport,
  createWebClipboardTransport,
  createWebShareTransport,
} from '../src/share.js';

describe('createWebShareTransport', () => {
  test('reports canShare when navigator.share exists and no screenshot', () => {
    const t = createWebShareTransport({ share: async () => {} });
    expect(t.canShare({ url: 'https://x' })).toBe(true);
  });

  test('declines when navigator.share is missing', () => {
    const t = createWebShareTransport({});
    expect(t.canShare({ url: 'https://x' })).toBe(false);
  });

  test('shares payload via navigator.share', async () => {
    let captured: unknown;
    const nav = {
      share: async (data: unknown) => {
        captured = data;
      },
    };
    const t = createWebShareTransport(nav);
    const res = await t.share({ title: 't', message: 'm', url: 'u' });
    expect(res.dispatched).toBe(true);
    expect(res.via).toBe('web-share');
    expect(captured).toEqual({ title: 't', text: 'm', url: 'u' });
  });
});

describe('createWebClipboardTransport', () => {
  test('copies message + url', async () => {
    let written: string | null = null;
    const t = createWebClipboardTransport({
      clipboard: {
        async writeText(v: string) {
          written = v;
        },
      },
    });
    const res = await t.share({ message: 'score!', url: 'https://f' });
    expect(res.dispatched).toBe(true);
    expect(written).toBe('score! https://f');
  });

  test('declines when clipboard missing', () => {
    const t = createWebClipboardTransport({});
    expect(t.canShare({ url: 'x' })).toBe(false);
  });
});

describe('createNativeShareTransport', () => {
  test('forwards to RN Share and reports dispatched on non-dismissed action', async () => {
    const t = createNativeShareTransport({
      async share() {
        return { action: 'sharedAction' };
      },
    });
    const res = await t.share({ title: 'x' });
    expect(res.dispatched).toBe(true);
    expect(res.via).toBe('native');
  });

  test('reports undispatched on dismissed', async () => {
    const t = createNativeShareTransport({
      async share() {
        return { action: 'dismissed' };
      },
    });
    const res = await t.share({ title: 'x' });
    expect(res.dispatched).toBe(false);
  });
});

describe('ShareManager', () => {
  test('picks the first capable transport', async () => {
    const log: string[] = [];
    const mgr = new ShareManager()
      .register({
        name: 'web-share',
        canShare: () => false,
        share: async () => {
          log.push('A');
          return { dispatched: false, via: 'web-share' };
        },
      })
      .register({
        name: 'web-clipboard',
        canShare: () => true,
        share: async () => {
          log.push('B');
          return { dispatched: true, via: 'web-clipboard' };
        },
      });
    const res = await mgr.share({ url: 'x' });
    expect(log).toEqual(['B']);
    expect(res.via).toBe('web-clipboard');
  });

  test('returns noop when nothing can handle it', async () => {
    const mgr = new ShareManager();
    const res = await mgr.share({});
    expect(res.via).toBe('noop');
    expect(res.dispatched).toBe(false);
  });
});
