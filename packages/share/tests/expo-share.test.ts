import { describe, expect, test } from 'bun:test';
import type {
  ExpoSharingLike,
  Screenshot,
  ShareFileWriterLike,
  ShareTransport,
} from '../src/index.js';
import {
  createExpoShareTransport,
  createNativeShareTransport,
  ShareManager,
} from '../src/index.js';

type ShareCall = { uri: string; options?: { dialogTitle?: string; mimeType?: string } };

function shot(format: Screenshot['format'] = 'png'): Screenshot {
  return { bytes: new Uint8Array([1, 2, 3]), base64: 'AQID', format, width: 2, height: 1 };
}

function fakes(opts: { available?: boolean } = {}) {
  const log: string[] = [];
  const writes: { name: string; base64: string }[] = [];
  const shares: ShareCall[] = [];
  const sharing: ExpoSharingLike = {
    isAvailableAsync: async () => {
      log.push('available');
      return opts.available ?? true;
    },
    shareAsync: async (uri, options) => {
      log.push('share');
      shares.push(options === undefined ? { uri } : { uri, options });
    },
  };
  const files: ShareFileWriterLike = {
    writeBase64File: async (name, base64) => {
      log.push('write');
      writes.push({ name, base64 });
      return `file:///cache/${name}`;
    },
  };
  return { log, writes, shares, sharing, files };
}

describe('createExpoShareTransport', () => {
  test('writes screenshot.<format> with the screenshot base64, then shares the returned uri', async () => {
    const f = fakes();
    const t = createExpoShareTransport(f.sharing, f.files);
    const res = await t.share({ title: 'High score', screenshot: shot('png') });
    expect(f.writes).toEqual([{ name: 'screenshot.png', base64: 'AQID' }]);
    expect(f.shares).toEqual([
      {
        uri: 'file:///cache/screenshot.png',
        options: { mimeType: 'image/png', dialogTitle: 'High score' },
      },
    ]);
    expect(f.log).toEqual(['available', 'write', 'share']);
    expect(res).toEqual({ dispatched: true, via: 'native' });
  });

  test('derives the file name and mime type from a jpeg screenshot', async () => {
    const f = fakes();
    await createExpoShareTransport(f.sharing, f.files).share({ screenshot: shot('jpeg') });
    expect(f.writes[0]?.name).toBe('screenshot.jpeg');
    expect(f.shares[0]?.uri).toBe('file:///cache/screenshot.jpeg');
    expect(f.shares[0]?.options?.mimeType).toBe('image/jpeg');
  });

  test('omits dialogTitle when the payload has no title', async () => {
    const f = fakes();
    await createExpoShareTransport(f.sharing, f.files).share({ screenshot: shot() });
    expect(f.shares[0]?.options).toEqual({ mimeType: 'image/png' });
    expect(Object.keys(f.shares[0]?.options ?? {})).toEqual(['mimeType']);
  });

  test('message and url are dropped: only the file uri and title reach expo-sharing', async () => {
    const f = fakes();
    await createExpoShareTransport(f.sharing, f.files).share({
      title: 't',
      message: 'm',
      url: 'https://x',
      screenshot: shot(),
    });
    expect(f.shares).toEqual([
      { uri: 'file:///cache/screenshot.png', options: { mimeType: 'image/png', dialogTitle: 't' } },
    ]);
  });

  test('canShare is true only for a payload with a screenshot', () => {
    const f = fakes();
    const t = createExpoShareTransport(f.sharing, f.files);
    expect(t.canShare({ screenshot: shot() })).toBe(true);
    expect(t.canShare({ title: 't', message: 'm', url: 'https://x' })).toBe(false);
    expect(t.canShare({})).toBe(false);
    expect(f.log).toEqual([]);
  });

  test('share() without a screenshot reports undispatched and touches nothing', async () => {
    const f = fakes();
    const res = await createExpoShareTransport(f.sharing, f.files).share({ message: 'm' });
    expect(res).toEqual({ dispatched: false, via: 'native' });
    expect(f.log).toEqual([]);
  });

  test('reports undispatched without writing when isAvailableAsync resolves false', async () => {
    const f = fakes({ available: false });
    const res = await createExpoShareTransport(f.sharing, f.files).share({ screenshot: shot() });
    expect(res).toEqual({ dispatched: false, via: 'native' });
    expect(f.log).toEqual(['available']);
  });

  test('a writer failure rejects and shareAsync is never called', async () => {
    const f = fakes();
    const files: ShareFileWriterLike = {
      writeBase64File: async () => {
        throw new Error('disk full');
      },
    };
    const t = createExpoShareTransport(f.sharing, files);
    await expect(t.share({ screenshot: shot() })).rejects.toThrow('disk full');
    expect(f.shares).toEqual([]);
  });

  test('a shareAsync failure rejects after the file was written', async () => {
    const f = fakes();
    const sharing: ExpoSharingLike = {
      isAvailableAsync: async () => true,
      shareAsync: async () => {
        throw new Error('no activity');
      },
    };
    const t = createExpoShareTransport(sharing, f.files);
    await expect(t.share({ screenshot: shot() })).rejects.toThrow('no activity');
    expect(f.writes.length).toBe(1);
  });

  test('registered before the RN transport: screenshots go to expo, text falls through', async () => {
    const f = fakes();
    const rn: { title?: string; message?: string; url?: string }[] = [];
    const expo: ShareTransport = createExpoShareTransport(f.sharing, f.files);
    const mgr = new ShareManager().register(expo).register(
      createNativeShareTransport({
        share: async (content) => {
          rn.push(content);
          return { action: 'sharedAction' };
        },
      }),
    );
    expect(await mgr.share({ message: 'hi', screenshot: shot() })).toEqual({
      dispatched: true,
      via: 'native',
    });
    expect(f.shares.length).toBe(1);
    expect(rn).toEqual([]);

    await mgr.share({ message: 'text only' });
    expect(rn).toEqual([{ message: 'text only' }]);
    expect(f.shares.length).toBe(1);
  });
});
