import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CORE_DIR = join(__dirname, '..');
const DIST_CJS = join(CORE_DIR, 'dist', 'index.js');
const DIST_ESM = join(CORE_DIR, 'dist', 'index.mjs');

// Companion to packages/render/tests/frame-renderer-dist.test.ts.
//
// `Pool.release()` runs once per released object — ~300 times a frame in a
// particle-heavy scene. PERF-10 moved its dev-flag check from a bare `__DEV__`
// identifier to a `globalThis` property read, which is ~400x cheaper wherever
// the global is undeclared (B28: web/CanvasKit, Node, Bun — React Native always
// defines it). Nothing else in the repo would notice a refactor putting the
// identifier form back, so the built artifact is pinned here.
//
// The CONSTRUCTOR deliberately keeps the identifier form — it runs once per
// pool, where the cost is free, and it is the site a bundler can constant-fold
// for dead-code elimination. So this file cannot simply assert the identifier
// is absent; it asserts the property form survived, and that neither site was
// frozen at build time.
//
// Build order comes from turbo (`test.dependsOn: ["build"]`); a bare `bun test`
// fails the existence assertions clearly, and the fix is `bun run build`.
describe('pool dist: the hot dev-flag read stays a property access', () => {
  test('dist/index.js exists after build', () => {
    expect(existsSync(DIST_CJS)).toBe(true);
  });

  test('dist/index.mjs exists after build', () => {
    expect(existsSync(DIST_ESM)).toBe(true);
  });

  for (const [label, path] of [
    ['dist/index.js', DIST_CJS],
    ['dist/index.mjs', DIST_ESM],
  ] as const) {
    test(`${label} reads the flag as a globalThis property in release()`, () => {
      const content = readFileSync(path, 'utf8');
      expect(content).toMatch(/\.__DEV__/);
    });

    test(`${label} was not constant-folded at build time`, () => {
      const content = readFileSync(path, 'utf8');
      expect(content).not.toContain('typeof true');
      expect(content).not.toContain('typeof false');
      expect(content).not.toContain('globalThis.true');
      expect(content).not.toContain('globalThis.false');
    });
  }
});
