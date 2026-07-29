import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RENDER_DIR = join(__dirname, '..');
const DIST_CJS = join(RENDER_DIR, 'dist', 'index.js');
const DIST_ESM = join(RENDER_DIR, 'dist', 'index.mjs');

// turbo.json declares test.dependsOn: ["build"] and build.dependsOn: ["^build"],
// so under `bun run test` all dep builds complete before this suite starts.
// For a bare `bun test` run the first assertions below fail clearly if dist is
// absent; the fix is `bun run build` in packages/render.
describe('frame-renderer dist: __DEV__ identifier survives tsdown', () => {
  test('dist/index.js exists after build', () => {
    expect(existsSync(DIST_CJS)).toBe(true);
  });

  test('dist/index.mjs exists after build', () => {
    expect(existsSync(DIST_ESM)).toBe(true);
  });

  test('dist/index.js still contains the literal text "typeof __DEV__"', () => {
    const content = readFileSync(DIST_CJS, 'utf8');
    const occurrences = (content.match(/typeof __DEV__/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
  });

  test('dist/index.mjs still contains the literal text "typeof __DEV__"', () => {
    const content = readFileSync(DIST_ESM, 'utf8');
    const occurrences = (content.match(/typeof __DEV__/g) ?? []).length;
    expect(occurrences).toBeGreaterThan(0);
  });

  test('dist/index.js does NOT contain "typeof true" or "typeof false"', () => {
    const content = readFileSync(DIST_CJS, 'utf8');
    expect(content).not.toContain('typeof true');
    expect(content).not.toContain('typeof false');
  });

  test('dist/index.mjs does NOT contain "typeof true" or "typeof false"', () => {
    const content = readFileSync(DIST_ESM, 'utf8');
    expect(content).not.toContain('typeof true');
    expect(content).not.toContain('typeof false');
  });
});
