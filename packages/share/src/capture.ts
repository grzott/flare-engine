/**
 * Cross-platform screenshot capture. The Flare renderer owns a Skia surface;
 * callers hand us a capturable reference + the target image format, and we
 * return a PNG/JPEG byte buffer plus a base64 encoding for sharing.
 */

export type ImageFormat = 'png' | 'jpeg';

export interface CaptureOptions {
  /** Output format, defaults to `png`. */
  format?: ImageFormat;
  /** JPEG quality (0–100). Ignored for PNG. Defaults to 90. */
  quality?: number;
}

export interface Screenshot {
  bytes: Uint8Array;
  base64: string;
  format: ImageFormat;
  width: number;
  height: number;
}

/**
 * Minimal shape of a Skia image that exposes `encodeToBytes` (RN Skia) or
 * `encodeToBase64`. We only rely on one of these — the capture wrapper tries
 * bytes first and falls back.
 */
export interface SkiaImageLike {
  width(): number;
  height(): number;
  encodeToBytes?(format?: number, quality?: number): Uint8Array | null;
  encodeToBase64?(format?: number, quality?: number): string | null;
}

/** Source that yields the current Skia image for capture. */
export interface CaptureSource {
  makeImageSnapshot(): SkiaImageLike | null;
}

const FORMAT_CODES: Record<ImageFormat, number> = { png: 3, jpeg: 2 };

export function captureScreenshot(
  source: CaptureSource,
  options: CaptureOptions = {},
): Screenshot | null {
  const image = source.makeImageSnapshot();
  if (!image) return null;
  const format = options.format ?? 'png';
  const quality = options.quality ?? 90;
  const code = FORMAT_CODES[format];

  let bytes: Uint8Array | null = null;
  let base64: string | null = null;

  if (image.encodeToBytes) {
    bytes = image.encodeToBytes(code, quality) ?? null;
  }
  if (image.encodeToBase64) {
    base64 = image.encodeToBase64(code, quality) ?? null;
  }

  if (!bytes && !base64) return null;
  if (!bytes && base64) bytes = base64ToBytes(base64);
  if (!base64 && bytes) base64 = bytesToBase64(bytes);

  return {
    bytes: bytes as Uint8Array,
    base64: base64 as string,
    format,
    width: image.width(),
    height: image.height(),
  };
}

// --- base64 helpers (platform-agnostic, UTF-8 safe for binary) -------------

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    const hasB1 = b1 !== undefined;
    const hasB2 = b2 !== undefined;
    const n = (b0 << 16) | ((hasB1 ? b1 : 0) << 8) | (hasB2 ? b2 : 0);
    out += BASE64_CHARS[(n >> 18) & 63];
    out += BASE64_CHARS[(n >> 12) & 63];
    out += hasB1 ? BASE64_CHARS[(n >> 6) & 63] : '=';
    out += hasB2 ? BASE64_CHARS[n & 63] : '=';
  }
  return out;
}

export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/=]/g, '');
  const padded = clean.replace(/=+$/, '');
  const len = padded.length;
  const outLen = Math.floor((len * 3) / 4);
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const c0 = BASE64_CHARS.indexOf(padded[i] ?? 'A');
    const c1 = BASE64_CHARS.indexOf(padded[i + 1] ?? 'A');
    const c2 = BASE64_CHARS.indexOf(padded[i + 2] ?? 'A');
    const c3 = BASE64_CHARS.indexOf(padded[i + 3] ?? 'A');
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (p < outLen) out[p++] = (n >> 16) & 0xff;
    if (p < outLen) out[p++] = (n >> 8) & 0xff;
    if (p < outLen) out[p++] = n & 0xff;
  }
  return out;
}
