import { describe, expect, test } from 'bun:test';
import { base64ToBytes, bytesToBase64, captureScreenshot } from '../src/capture.js';

describe('base64 roundtrip', () => {
  test('empty buffer', () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array([]));
  });

  test('known values', () => {
    expect(bytesToBase64(new Uint8Array([102, 111, 111]))).toBe('Zm9v');
    expect(bytesToBase64(new Uint8Array([102, 111, 111, 98]))).toBe('Zm9vYg==');
    expect(bytesToBase64(new Uint8Array([102, 111, 111, 98, 97]))).toBe('Zm9vYmE=');
  });

  test('roundtrip preserves binary', () => {
    const src = new Uint8Array(256);
    for (let i = 0; i < 256; i++) src[i] = i;
    const encoded = bytesToBase64(src);
    const decoded = base64ToBytes(encoded);
    expect(decoded).toEqual(src);
  });
});

describe('captureScreenshot', () => {
  test('returns null when source yields no image', () => {
    const result = captureScreenshot({ makeImageSnapshot: () => null });
    expect(result).toBeNull();
  });

  test('uses encodeToBytes and computes base64', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const source = {
      makeImageSnapshot: () => ({
        width: () => 64,
        height: () => 32,
        encodeToBytes: () => bytes,
      }),
    };
    const shot = captureScreenshot(source, { format: 'png' });
    expect(shot).not.toBeNull();
    expect(shot?.bytes).toBe(bytes);
    expect(shot?.width).toBe(64);
    expect(shot?.height).toBe(32);
    expect(shot?.format).toBe('png');
    expect(shot?.base64).toBe(bytesToBase64(bytes));
  });

  test('falls back to encodeToBase64 when bytes are unavailable', () => {
    const base64 = 'Zm9v';
    const shot = captureScreenshot({
      makeImageSnapshot: () => ({
        width: () => 1,
        height: () => 1,
        encodeToBase64: () => base64,
      }),
    });
    expect(shot?.base64).toBe(base64);
    expect(shot?.bytes).toEqual(base64ToBytes(base64));
  });

  test('returns null when neither encoder works', () => {
    const shot = captureScreenshot({
      makeImageSnapshot: () => ({
        width: () => 1,
        height: () => 1,
        encodeToBytes: () => null,
        encodeToBase64: () => null,
      }),
    });
    expect(shot).toBeNull();
  });

  test('jpeg format propagates', () => {
    const shot = captureScreenshot(
      {
        makeImageSnapshot: () => ({
          width: () => 4,
          height: () => 4,
          encodeToBytes: () => new Uint8Array([9, 9]),
        }),
      },
      { format: 'jpeg', quality: 60 },
    );
    expect(shot?.format).toBe('jpeg');
  });
});
