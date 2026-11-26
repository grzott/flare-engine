import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REACT_FREE_EXPORT = 'createMemoryLeaderboards';
const CONTEXT_EXPORT = 'LeaderboardsContext';

// The built ESM entry, not `src/`: it is what a consumer's bundler sees, and the
// package's own `"sideEffects": false` applies to it. `turbo test` builds first.
const DIST_ENTRY = resolve(import.meta.dir, '../dist/index.mjs');
const REACT_IMPORT = /from\s*["']react["']|require\(\s*["']react["']\s*\)/;

let probeDir = '';

async function bundleImporting(exportName: string): Promise<string> {
  const probe = join(probeDir, `${exportName}.mjs`);
  await writeFile(
    probe,
    `import { ${exportName} } from ${JSON.stringify(DIST_ENTRY)};\nglobalThis.__probe = ${exportName};\n`,
  );
  const result = await Bun.build({
    entrypoints: [probe],
    target: 'browser',
    format: 'esm',
    external: ['react', '@flare-engine/*'],
  });
  expect(result.success).toBe(true);
  expect(result.outputs).toHaveLength(1);
  const output = result.outputs[0];
  if (output === undefined) throw new Error('Bun.build produced no output');
  return output.text();
}

beforeAll(async () => {
  probeDir = await mkdtemp(join(tmpdir(), 'flare-tree-shake-'));
});

afterAll(async () => {
  await rm(probeDir, { recursive: true, force: true });
});

describe('tree-shaking the built ESM entry', () => {
  test(`a bundle importing only ${REACT_FREE_EXPORT} drops react and createContext`, async () => {
    const code = await bundleImporting(REACT_FREE_EXPORT);
    expect(code).toContain(REACT_FREE_EXPORT);
    expect(code).not.toMatch(REACT_IMPORT);
    expect(code).not.toContain('createContext(');
  });

  // Positive control: the same probe does see react when the context is imported,
  // so the assertions above cannot pass on a bundle that lost everything.
  test(`a bundle importing ${CONTEXT_EXPORT} keeps react and createContext`, async () => {
    const code = await bundleImporting(CONTEXT_EXPORT);
    expect(code).toMatch(REACT_IMPORT);
    expect(code).toContain('createContext(');
  });
});
