/**
 * Runs each test file of the current package in its own `bun test` process.
 *
 * bun's `mock.module` is process-global: whichever file mocks a module first
 * freezes that module's export set, and every later file's overrides persist
 * into the files after it. bun walks test files in readdir order — alphabetical
 * on Windows, filesystem-hash order on the Linux CI runner — so a suite that is
 * green locally can be red in CI only. `ci.yml` failed on every `main` run from
 * July to October 2026 for exactly this reason, in ui, react, render and
 * render-web by turns. One process per file removes the order dependence
 * instead of relying on every file's mocks carrying an identical key set.
 *
 * Usage, as a package's `test` script: `bun ../../scripts/test-isolated.mjs`.
 * Extra arguments are passed to every `bun test` invocation.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

/** bun test's own discovery patterns: `.test`, `_test`, `.spec`, `_spec`. */
const TEST_FILE = /[._](test|spec)\.[cm]?[jt]sx?$/;

/** Every test file under `dir`, as sorted `./`-prefixed POSIX paths relative to `dir`. */
export const discoverTestFiles = (dir) => {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(current, entry.name));
      } else if (TEST_FILE.test(entry.name)) {
        found.push(`./${relative(dir, join(current, entry.name)).split(sep).join('/')}`);
      }
    }
  };
  walk(dir);
  return found.sort();
};

/**
 * Runs `runFile(file, args)` for every file and returns the files whose run
 * exited non-zero. `runFile` returns an exit status; injected so the
 * aggregation is testable without spawning bun.
 */
export const runIsolated = (files, args, runFile) =>
  files.filter((file) => runFile(file, args) !== 0);

const runWithBun = (file, args) =>
  spawnSync(process.execPath, ['test', file, ...args], { stdio: 'inherit' }).status ?? 1;

if (import.meta.main) {
  const files = discoverTestFiles(process.cwd());
  if (files.length === 0) {
    console.error('test-isolated: no test files found — refusing to report an empty run as green.');
    process.exit(1);
  }
  const failed = runIsolated(files, process.argv.slice(2), runWithBun);
  if (failed.length > 0) {
    console.error(`\ntest-isolated: ${failed.length} of ${files.length} file(s) failed:`);
    for (const file of failed) console.error(`  ${file}`);
    process.exit(1);
  }
  console.log(`\ntest-isolated: all ${files.length} file(s) passed, one process each.`);
}
