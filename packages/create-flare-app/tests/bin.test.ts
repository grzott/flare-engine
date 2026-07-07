import { beforeAll, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { version } from '../package.json';

const PKG_DIR = join(__dirname, '..');

describe('bin smoke', () => {
  beforeAll(() => {
    execFileSync('bun', ['run', 'build'], { cwd: PKG_DIR, stdio: 'ignore' });
  }, 30_000);

  test('CJS bin (dist/bin.js) prints version without crashing', () => {
    const output = execFileSync('node', [join(PKG_DIR, 'dist', 'bin.js'), '--version'], {
      cwd: PKG_DIR,
      encoding: 'utf8',
    });
    expect(output.trim()).toBe(version);
  });

  test('ESM bin (dist/bin.mjs) prints version without crashing', () => {
    const output = execFileSync('node', [join(PKG_DIR, 'dist', 'bin.mjs'), '--version'], {
      cwd: PKG_DIR,
      encoding: 'utf8',
    });
    expect(output.trim()).toBe(version);
  });
});
