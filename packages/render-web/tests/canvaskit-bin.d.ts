/** Ambient module declaration for the Emscripten-generated CanvasKit JS bundle. */
declare module 'canvaskit-wasm/bin/full/canvaskit.js' {
  import type { CanvasKit } from 'canvaskit-wasm';
  const init: (opts: {
    locateFile: (f: string) => string;
    wasmBinary?: Uint8Array;
  }) => Promise<CanvasKit>;
  export default init;
}
