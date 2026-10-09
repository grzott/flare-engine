/**
 * Type surface for `test-isolated.mjs`, hand-written because the implementation
 * is plain ESM like every sibling `scripts/**\/*.mjs` gate.
 */

export declare function discoverTestFiles(dir: string): string[];

export declare function runIsolated(
  files: readonly string[],
  args: readonly string[],
  runFile: (file: string, args: readonly string[]) => number,
): string[];
