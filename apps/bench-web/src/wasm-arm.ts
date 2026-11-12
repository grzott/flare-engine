/**
 * #210 A/B: the `?wasmArm=` query switch for `loadCanvasKit`'s wasm hand-off. Strip this file with
 * the loader switch once the experiment is decided.
 *
 *  - `blob`: today's path — download with progress, hand the glue a `blob:` URL of the bytes.
 *  - `url`: no download of our own; the glue streams the server URL itself (one download).
 *  - `url-cached`: download with progress, then hand the glue the same server URL, so its fetch can
 *    come from the HTTP cache while its source stays http(s). This is the pre-#196 call.
 *
 * No query parameter leaves the global unset, which is `blob` with no marker written back.
 */
export const WASM_ARMS = ['blob', 'url', 'url-cached'] as const;

export type WasmArm = (typeof WASM_ARMS)[number];

/** The arm named by `?wasmArm=`, or `null` when absent. An unknown name throws: a typo must not
 *  silently measure `blob` under another arm's label. */
export function parseWasmArm(search: string): WasmArm | null {
  const raw = new URLSearchParams(search).get('wasmArm');
  if (raw === null) return null;
  const arm = WASM_ARMS.find((a) => a === raw);
  if (arm === undefined) {
    throw new Error(
      `bench-web: unknown wasmArm ${JSON.stringify(raw)}; expected one of ${WASM_ARMS.join(', ')}`,
    );
  }
  return arm;
}

/** Sets the loader's `globalThis.__FLARE_WASM_ARM` from the page query. Call before `loadCanvasKit`. */
export function applyWasmArm(search: string): void {
  const arm = parseWasmArm(search);
  if (arm !== null) Reflect.set(globalThis, '__FLARE_WASM_ARM', arm);
}
