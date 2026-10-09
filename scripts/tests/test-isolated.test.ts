import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverTestFiles, runIsolated } from '../test-isolated.mjs';

let pkg = '';

beforeAll(() => {
  pkg = mkdtempSync(join(tmpdir(), 'test-isolated-'));
  const files = [
    'tests/b.test.ts',
    'tests/a.test.tsx',
    'tests/nested/c_test.ts',
    'tests/d.spec.mjs',
    'tests/helpers.ts',
    'tests/e.test.ts.snap',
    'src/inline.test.ts',
    'node_modules/dep/x.test.ts',
    'dist/y.test.js',
  ];
  for (const file of files) {
    mkdirSync(join(pkg, file, '..'), { recursive: true });
    writeFileSync(join(pkg, file), '');
  }
});

afterAll(() => {
  rmSync(pkg, { recursive: true, force: true });
});

describe('discoverTestFiles', () => {
  it('finds every test file bun would, sorted, skipping node_modules and dist', () => {
    expect(discoverTestFiles(pkg)).toEqual([
      './src/inline.test.ts',
      './tests/a.test.tsx',
      './tests/b.test.ts',
      './tests/d.spec.mjs',
      './tests/nested/c_test.ts',
    ]);
  });

  it('returns an empty list for a directory with no tests', () => {
    const empty = mkdtempSync(join(tmpdir(), 'test-isolated-empty-'));
    try {
      expect(discoverTestFiles(empty)).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('runIsolated', () => {
  it('runs every file once, in order, passing the same args to each', () => {
    const calls: string[] = [];
    runIsolated(['./a.test.ts', './b.test.ts'], ['--timeout', '50'], (file, args) => {
      calls.push(`${file} ${args.join(' ')}`);
      return 0;
    });
    expect(calls).toEqual(['./a.test.ts --timeout 50', './b.test.ts --timeout 50']);
  });

  it('reports exactly the files whose run exited non-zero', () => {
    const status: Record<string, number> = { './a.test.ts': 0, './b.test.ts': 1, './c.test.ts': 2 };
    expect(runIsolated(Object.keys(status), [], (file) => status[file] ?? 0)).toEqual([
      './b.test.ts',
      './c.test.ts',
    ]);
  });

  it('keeps running after a failure instead of stopping at the first one', () => {
    const ran: string[] = [];
    runIsolated(['./a.test.ts', './b.test.ts', './c.test.ts'], [], (file) => {
      ran.push(file);
      return file === './a.test.ts' ? 1 : 0;
    });
    expect(ran).toEqual(['./a.test.ts', './b.test.ts', './c.test.ts']);
  });
});
