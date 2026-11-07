import { describe, expect, test } from 'bun:test';
import type { FileCtorLike, WebNavigatorLike } from '../src/index.js';
import {
  createNativeShareTransport,
  createWebClipboardTransport,
  createWebShareTransport,
  ShareManager,
} from '../src/share.js';

describe('createWebShareTransport', () => {
  test('accepts a navigator typed as the exported WebNavigatorLike plus a FileCtorLike', async () => {
    const shared: { title?: string; text?: string; url?: string; files?: File[] }[] = [];
    const nav: WebNavigatorLike = {
      share: async (data) => {
        shared.push(data);
      },
      canShare: () => true,
    };
    const fileCtor: FileCtorLike = File;
    const t = createWebShareTransport(nav, fileCtor);
    const shot = {
      bytes: new Uint8Array([1, 2]),
      base64: '',
      format: 'png' as const,
      width: 1,
      height: 1,
    };
    expect(t.canShare({ screenshot: shot })).toBe(true);
    const res = await t.share({ title: 't', url: 'u', screenshot: shot });
    expect(res).toEqual({ dispatched: true, via: 'web-share' });
    expect(shared.length).toBe(1);
    expect(shared[0]?.title).toBe('t');
    expect(shared[0]?.url).toBe('u');
    expect(shared[0]?.files?.[0]?.name).toBe('screenshot.png');
    expect(shared[0]?.files?.[0]?.type).toBe('image/png');
  });

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

  test('canShare derives the file extension from the screenshot format', () => {
    let capturedName: string | undefined;
    const nav = {
      share: async () => {},
      canShare: (data: { files?: File[] }) => {
        capturedName = data.files?.[0]?.name;
        return true;
      },
    };
    const t = createWebShareTransport(nav, File);
    const shot = {
      bytes: new Uint8Array([1]),
      base64: '',
      format: 'jpeg' as const,
      width: 1,
      height: 1,
    };
    expect(t.canShare({ screenshot: shot })).toBe(true);
    expect(capturedName).toBe('screenshot.jpeg'); // old code hardcoded 'screenshot.png'
  });
});

describe('createWebClipboardTransport', () => {
  test('accepts a navigator typed as the exported WebNavigatorLike', async () => {
    const written: string[] = [];
    const nav: WebNavigatorLike = {
      clipboard: {
        async writeText(text) {
          written.push(text);
        },
      },
    };
    const t = createWebClipboardTransport(nav);
    expect(t.canShare({ message: 'hi' })).toBe(true);
    const res = await t.share({ message: 'hi', url: 'https://f' });
    expect(res).toEqual({ dispatched: true, via: 'web-clipboard' });
    expect(written).toEqual(['hi https://f']);
  });

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
    expect(written!).toBe('score! https://f');
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

  test('reports undispatched on the real RN dismissedAction (iOS cancel)', async () => {
    // RN returns Share.dismissedAction === 'dismissedAction' on iOS cancel,
    // never a bare 'dismissed' — the old `!== 'dismissed'` check misreported
    // this as dispatched:true.
    const t = createNativeShareTransport({
      async share() {
        return { action: 'dismissedAction' };
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
