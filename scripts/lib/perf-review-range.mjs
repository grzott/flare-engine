/**
 * The change range the rubber-stamp guard (check-perf.mjs, `reconcileReviews`)
 * inspects: what moved between a base commit and HEAD, plus the working tree.
 *
 * The base must be the commit the change actually starts from. On a pull
 * request that is the merge ref's first parent, not `pull_request.base.sha`:
 * GitHub leaves that SHA where `main` was when the PR opened, so the range
 * from it also covers every commit that reached `main` since, and another
 * PR's baseline edit can be blamed on this one (#459).
 */
import { gitAt } from './git.mjs';

const BASELINE = '.perf-baseline.json';
const SHIPPED_SRC = /^packages\/[^/]+\/src\//;

/**
 * `requested` (FLARE_PERF_BASE_REF) when it names a commit, else `HEAD~1`,
 * else null. An all-zero SHA is a push that created the branch: no base.
 */
export function resolveBaseRef(requested, git) {
  const ref = requested?.trim();
  if (ref && !/^0+$/.test(ref) && git('rev-parse', '--verify', '--quiet', `${ref}^{commit}`)) {
    return ref;
  }
  return git('rev-parse', '--verify', '--quiet', 'HEAD~1^{commit}') ? 'HEAD~1' : null;
}

/**
 * Inputs for `reconcileReviews` in the repository at `cwd`, measured from
 * `requested` to HEAD and the working tree.
 */
export function reviewRange(requested, cwd) {
  const { git, gitLines } = gitAt(cwd);
  const baseRef = resolveBaseRef(requested, git);

  const changed = new Set();
  const add = (p) => {
    const clean = p.trim().replace(/\\/g, '/');
    if (clean) changed.add(clean);
  };
  if (baseRef) for (const f of gitLines('diff', '--name-only', baseRef, 'HEAD')) add(f);
  // `-uall` expands untracked directories: without it git collapses a brand-new
  // `packages/foo/src/` to the directory alone and the src test misses it.
  for (const line of gitLines('status', '--porcelain', '-uall')) {
    const path = line.slice(3);
    // Renames arrive as "old -> new"; the destination is what changed.
    add(path.includes(' -> ') ? path.slice(path.indexOf(' -> ') + 4) : path);
  }

  const baselineTouched = changed.has(BASELINE);
  const srcTouched = [...changed].some((p) => SHIPPED_SRC.test(p));

  let oldReviews = [];
  if (baseRef && baselineTouched) {
    try {
      oldReviews = JSON.parse(git('show', `${baseRef}:${BASELINE}`)).reviews ?? [];
    } catch {
      // The file did not exist at the base ref — first population. Every current
      // review entry is therefore new, which reconcileReviews handles.
      oldReviews = [];
    }
  }

  return { baseRef, baselineTouched, srcTouched, oldReviews };
}
