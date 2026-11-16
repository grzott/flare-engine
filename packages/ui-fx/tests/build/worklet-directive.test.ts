import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG = join(import.meta.dir, '..', '..');
const SRC = join(PKG, 'src');
const DIST = join(PKG, 'dist');

/** A function body whose first statement is the directive, in either quote style. */
const WORKLET_BODY = /\{\s*(['"])worklet\1/g;

const countDirectives = (files: readonly string[]): number => {
  let count = 0;
  for (const file of files) count += readFileSync(file, 'utf8').match(WORKLET_BODY)?.length ?? 0;
  return count;
};

const sourceFiles = (dir: string): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
};

const distFiles = (extension: '.mjs' | '.js'): string[] =>
  readdirSync(DIST)
    .filter((name) => name.endsWith(extension))
    .map((name) => join(DIST, name));

describe("dist keeps the 'worklet' directive", () => {
  test('the package is built', () => {
    // Without this an unbuilt package would compare zero against zero and pass.
    expect(existsSync(DIST)).toBe(true);
    expect(distFiles('.mjs').length).toBeGreaterThan(0);
    expect(distFiles('.js').length).toBeGreaterThan(0);
  });

  test('src has worklet functions to keep', () => {
    expect(countDirectives(sourceFiles(SRC))).toBeGreaterThan(0);
  });

  test('the ESM build has as many worklet functions as src', () => {
    expect(countDirectives(distFiles('.mjs'))).toBe(countDirectives(sourceFiles(SRC)));
  });

  test('the CJS build has as many worklet functions as src', () => {
    expect(countDirectives(distFiles('.js'))).toBe(countDirectives(sourceFiles(SRC)));
  });

  test('the matcher counts a directive and ignores the bare word', () => {
    const sample = 'function a() {\n  \'worklet\';\n}\nconst b = () => { "worklet"; };\n// worklet';
    expect(sample.match(WORKLET_BODY)?.length).toBe(2);
  });
});
