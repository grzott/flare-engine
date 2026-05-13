import { describe, expect, it } from 'bun:test';
import { createTexture } from '../src/texture.js';
import type { SkImageLike } from '../src/texture.js';

function mockImage(w: number, h: number): SkImageLike {
  return { width: () => w, height: () => h, readPixels: () => null };
}

describe('Texture', () => {
  it('creates from SkImage-like object', () => {
    const img = mockImage(256, 128);
    const tex = createTexture('player', img);
    expect(tex.key).toBe('player');
    expect(tex.width).toBe(256);
    expect(tex.height).toBe(128);
    expect(tex.image).toBe(img);
  });

  it('reads dimensions from image at creation time', () => {
    let w = 64;
    const img: SkImageLike = {
      width: () => w,
      height: () => 32,
      readPixels: () => null,
    };
    const tex = createTexture('test', img);
    // Dimensions are captured at creation
    w = 128;
    expect(tex.width).toBe(64);
  });

  it('accepts a mock implementation returning a Uint8Array', () => {
    const bytes = new Uint8Array([255, 0, 128, 255]);
    const img: SkImageLike = {
      width: () => 1,
      height: () => 1,
      readPixels: () => bytes,
    };
    expect(img.readPixels?.()).toBe(bytes);
  });
});
