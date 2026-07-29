/**
 * Shared `npm pack` primitives — "what actually ships", as opposed to what is
 * on disk.
 *
 * Two gates need the published artifact rather than the source tree:
 * audit-tarballs (scans the bytes for leaks) and check-perf (weighs them). They
 * must agree on the target list and on what counts as a broken pack, so the
 * discovery + unbuilt-dist logic lives here once instead of drifting in two
 * copies.
 *
 * Plain ESM, Bun- and Node-runnable. No exports outside `scripts/`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const SCOPE = '@flare-engine/';

/** No shell — args go straight to npm (safe on Windows cmd.exe and POSIX). */
export const npm = (...args) =>
  execFileSync('npm', args, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

/**
 * Entry-point paths a consumer actually imports, collected from the manifest.
 * Used to catch an unbuilt/empty dist that would otherwise look like a clean,
 * tiny package: `npm pack --ignore-scripts` silently drops an unmatched
 * `files:["dist"]` glob, so a package with no dist/ still packs (manifest +
 * README + LICENSE + NOTICE) — it scans as zero leaks and weighs ~2 KB.
 */
export const declaredEntryPoints = (manifest) => {
  const out = new Set();
  const add = (p) => {
    if (typeof p !== 'string') return;
    const n = p.replace(/^\.\//, '');
    if (n) out.add(n);
  };
  for (const key of ['main', 'module', 'types']) add(manifest[key]);
  const walk = (node) => {
    if (typeof node === 'string') add(node);
    else if (node && typeof node === 'object') for (const v of Object.values(node)) walk(v);
  };
  walk(manifest.exports);
  return [...out];
};

/**
 * Every package this repo publishes: the scoped `@flare-engine/*` that are not
 * private, plus unscoped `create-flare-app` (private today, flips public at
 * launch — it ships, so it is weighed and scanned like the rest).
 */
export const discoverPublishTargets = (only) => {
  const packagesDir = join(REPO_ROOT, 'packages');
  const targets = [];
  for (const name of readdirSync(packagesDir).sort()) {
    const dir = join(packagesDir, name);
    const manifestPath = join(dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (typeof pkg.name !== 'string') continue;
    const isScoped = pkg.name.startsWith(SCOPE);
    const isCreateFlareApp = pkg.name === 'create-flare-app';
    if (!((isScoped && !pkg.private) || isCreateFlareApp)) continue;
    if (only && !pkg.name.includes(only)) continue;
    targets.push({ name: pkg.name, dir, flipsPublic: isCreateFlareApp });
  }
  return targets;
};

/**
 * Packs `spec` ({dir} for HEAD, {name,version} for a published fetch) into a
 * scratch dir, hands `{ path, meta }` to `fn`, and always removes the scratch
 * dir afterwards. `meta` is npm's own `--json` record: `size` is the gzipped
 * tarball, `files` is the shipped path list.
 *
 * Returns `{ok:false, reason}` rather than throwing: a single package failing
 * to pack is a finding to report, not a reason to abandon the other forty.
 */
export const withPackedTarball = (spec, workDir, fn) => {
  const dest = mkdtempSync(join(workDir, 'pkg-'));
  try {
    const packArg = spec.dir ?? `${spec.name}@${spec.version}`;
    const out = npm('pack', '--json', '--ignore-scripts', '--pack-destination', dest, packArg);
    const parsed = JSON.parse(out);
    const meta = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!meta?.filename) return { ok: false, reason: 'npm pack returned no filename' };
    return fn({ path: join(dest, meta.filename), meta });
  } catch (err) {
    return {
      ok: false,
      reason: String(err.stderr || err.message || err)
        .split('\n')[0]
        .trim(),
    };
  } finally {
    rmSync(dest, { recursive: true, force: true });
  }
};

/**
 * Workspace dependency closure for `@flare-engine/*` names, by package DIRECTORY
 * (which is not always the scope-stripped name). Callers that reason about
 * "which source can move this measurement" need the transitive set: a change in
 * `math` moves every `render` number, and a hand-maintained list of that would
 * be wrong within a release.
 */
export const workspaceClosure = (names) => {
  const byName = new Map();
  const packagesDir = join(REPO_ROOT, 'packages');
  for (const dir of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(manifestPath)) continue;
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (typeof pkg.name !== 'string') continue;
    byName.set(pkg.name, { dir, deps: Object.keys(pkg.dependencies ?? {}) });
  }

  const seen = new Set();
  const queue = [...names];
  const unknown = [];
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    const entry = byName.get(name);
    if (!entry) {
      unknown.push(name);
      continue;
    }
    seen.add(name);
    for (const dep of entry.deps) if (dep.startsWith(SCOPE)) queue.push(dep);
  }
  return {
    names: [...seen].sort(),
    dirs: [...seen].map((n) => byName.get(n).dir).sort(),
    unknown,
  };
};
