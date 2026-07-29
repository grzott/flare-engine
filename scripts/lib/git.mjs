/**
 * Git helpers shared by the perf gates.
 *
 * `gitLines` exists because of a specific bug: `git status --porcelain` encodes
 * the staged/unstaged pair in columns 1-2, so an unstaged edit begins with a
 * SPACE. Trimming the whole output eats the first character of the first path —
 * `.perf-baseline.json` arrives as `perf-baseline.json` — which silently blinded
 * the rubber-stamp guard to the one file it watches. Never `.trim()` porcelain.
 */
import { execFileSync } from 'node:child_process';
import { REPO_ROOT } from './pack.mjs';

/** Trimmed single-value git output; empty string on any failure. */
export const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

/** Untrimmed line split — the only safe way to read `--porcelain`. */
export const gitLines = (...args) => {
  try {
    return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
      .split('\n')
      .map((l) => l.replace(/\r$/, ''))
      .filter((l) => l !== '');
  } catch {
    return [];
  }
};

/** True when the command exits 0. For predicates like `merge-base --is-ancestor`. */
export const gitOk = (...args) => {
  try {
    execFileSync('git', args, { cwd: REPO_ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Paths with uncommitted changes under `paths`, tracked or not.
 *
 * `-uall` expands untracked directories: git otherwise collapses a brand-new
 * `packages/foo/src/` to the directory alone, and a path test looking for files
 * beneath it finds nothing.
 */
export const dirtyPaths = (paths) => {
  if (paths.length === 0) return [];
  return gitLines('status', '--porcelain', '-uall', '--', ...paths).map((line) => {
    const p = line.slice(3);
    // Renames arrive as "old -> new"; the destination is what changed.
    return p.includes(' -> ') ? p.slice(p.indexOf(' -> ') + 4) : p;
  });
};
