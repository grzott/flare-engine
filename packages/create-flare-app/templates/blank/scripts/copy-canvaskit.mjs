import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

// LoadSkiaWeb imports canvaskit-wasm/bin/full/canvaskit, so the binary served
// at / must be the `full` build (~8 MB). bin/canvaskit.wasm is a smaller,
// ABI-incompatible variant — serving it fails at runtime, not at build time.
const require = createRequire(import.meta.url);
const source = require.resolve("canvaskit-wasm/bin/full/canvaskit.wasm");
const targetDir = join(process.cwd(), "public");

await mkdir(targetDir, { recursive: true });
await copyFile(source, join(targetDir, "canvaskit.wasm"));

console.log("copy-canvaskit: public/canvaskit.wasm");
