/**
 * The no-GPU numbers that need no browser at all: CanvasKit WASM payload bytes, read straight
 * off the installed `canvaskit-wasm` package (never hardcoded), plus the synthetic "4G" network
 * profile `scripts/coldstart-driver.mjs` applies via the Chrome DevTools Protocol for the
 * throttled cold-start measurement.
 *
 * Gzip counts shell out to the system `gzip` binary rather than using `node:zlib`: GNU gzip and
 * zlib's deflate are different codebases and do not produce byte-identical output at the "same"
 * compression level, so a `zlib.gzipSync` number would disagree with the `gzip -c file | wc -c`
 * hand-verification this script's caller runs — and a payload number that disagrees with the
 * file on disk is worse than no number.
 */
import { statSync } from 'node:fs';

export type PayloadByte = {
  readonly name: string;
  readonly bytes: number;
};

function gzipByteCount(path: string): number {
  const proc = Bun.spawnSync(['gzip', '-c', path]);
  if (!proc.success) {
    throw new Error(
      `bench-web: \`gzip -c ${path}\` exited ${proc.exitCode} — the \`gzip\` binary must be on ` +
        'PATH so the gzip byte counts match the hand-verification command exactly.',
    );
  }
  return proc.stdout.length;
}

/**
 * Resolves the installed `canvaskit-wasm` package's `default` and `full` binaries (via normal
 * module resolution, from this file's location — never a hardcoded path) and measures raw +
 * gzipped bytes for each: four numbers, all read from disk.
 */
export function measureCanvasKitPayload(): PayloadByte[] {
  const defaultPath = Bun.resolveSync('canvaskit-wasm/bin/canvaskit.wasm', import.meta.dir);
  const fullPath = Bun.resolveSync('canvaskit-wasm/bin/full/canvaskit.wasm', import.meta.dir);
  return [
    { name: 'canvaskit.default.raw', bytes: statSync(defaultPath).size },
    { name: 'canvaskit.default.gzip', bytes: gzipByteCount(defaultPath) },
    { name: 'canvaskit.full.raw', bytes: statSync(fullPath).size },
    { name: 'canvaskit.full.gzip', bytes: gzipByteCount(fullPath) },
  ];
}

export type NetworkProfile = {
  readonly downloadThroughputBytesPerSec: number;
  readonly uploadThroughputBytesPerSec: number;
  readonly latencyMs: number;
};

/**
 * A flare-engine-defined synthetic "4G" throttle profile applied via CDP's
 * `Network.emulateNetworkConditions` in `scripts/coldstart-driver.mjs` — not a copy of any
 * external tool's preset. Stated here in full, and carried on every throttled cold-start record,
 * so the number is exactly reproducible:
 *   - download: 4 Mbit/s  (524288 B/s)
 *   - upload:   3 Mbit/s  (393216 B/s)
 *   - latency:  20ms round-trip
 */
export const FOUR_G_PROFILE: NetworkProfile = {
  downloadThroughputBytesPerSec: (4 * 1024 * 1024) / 8,
  uploadThroughputBytesPerSec: (3 * 1024 * 1024) / 8,
  latencyMs: 20,
};
