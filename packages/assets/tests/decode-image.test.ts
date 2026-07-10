import { describe, expect, it } from 'bun:test';
import {
  decodeImage,
  type SkDataLike,
  type SkiaImageDecodeModuleLike,
} from '../src/decode-image.js';
import type { SkImageLike } from '../src/texture.js';

function makeImage(w: number, h: number): SkImageLike {
  return {
    width: () => w,
    height: () => h,
    readPixels: () => null,
  };
}

function makeSentinel(): SkDataLike {
  return {} as unknown as SkDataLike;
}

describe('decodeImage', () => {
  it('success path returns the SkImageLike with readable width/height', () => {
    const image = makeImage(64, 32);
    const skia: SkiaImageDecodeModuleLike = {
      Data: { fromBytes: () => makeSentinel() },
      Image: { MakeImageFromEncoded: () => image },
    };

    const result = decodeImage(skia, new Uint8Array([1, 2, 3]));

    expect(result).not.toBeNull();
    expect(result?.width()).toBe(64);
    expect(result?.height()).toBe(32);
  });

  it('returns null when MakeImageFromEncoded returns null', () => {
    const skia: SkiaImageDecodeModuleLike = {
      Data: { fromBytes: () => makeSentinel() },
      Image: { MakeImageFromEncoded: () => null },
    };

    const result = decodeImage(skia, new Uint8Array([0xff]));

    expect(result).toBeNull();
  });

  it('passes the exact input bytes to Data.fromBytes', () => {
    const bytes = new Uint8Array([10, 20, 30, 40]);
    const received: Uint8Array[] = [];

    const skia: SkiaImageDecodeModuleLike = {
      Data: {
        fromBytes(b) {
          received.push(b);
          return makeSentinel();
        },
      },
      Image: { MakeImageFromEncoded: () => makeImage(1, 1) },
    };

    decodeImage(skia, bytes);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(bytes);
  });

  it('passes the SkData sentinel from fromBytes to MakeImageFromEncoded', () => {
    const sentinel = makeSentinel();
    const receivedData: SkDataLike[] = [];

    const skia: SkiaImageDecodeModuleLike = {
      Data: { fromBytes: () => sentinel },
      Image: {
        MakeImageFromEncoded(data) {
          receivedData.push(data);
          return makeImage(1, 1);
        },
      },
    };

    decodeImage(skia, new Uint8Array([0]));

    expect(receivedData).toHaveLength(1);
    expect(receivedData[0]).toBe(sentinel);
  });
});
