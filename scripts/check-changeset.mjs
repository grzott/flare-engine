/**
 * check-changeset — fail if a publishable package's shipped `src` changed since
 * the last release without a changeset (or an already-applied version bump) to
 * cover it. Keeps the changelog honest: every shipped change is described.
 *
 * A changed publishable package is COVERED when either:
 *   - a pending `.changeset/*.md` lists it, OR
 *   - its `package.json` version is already ahead of its latest release tag
 *     (i.e. `changeset version` has run; the release is pending publish).
 *
 * Exempt: private packages, `benchmarks`, and anything
 * whose change is confined to `tests/`, docs, or tooling (only `src/**` counts).
 * For a truly non-shippable src change, add an empty changeset (`bunx changeset
 * --empty`). Bun-runnable plain ESM. Exit 1 on any violation, 0 when clean.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const SCOPE = '@flare-engine/';
const IGNORE = new Set(['benchmarks']);

// No shell — args go straight to git.exe (safe on Windows cmd.exe and POSIX).
const git = (...args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

const newestTagMatching = (pattern) =>
  git('for-each-ref', '--sort=-creatordate', '--format=%(refname:short)', `refs/tags/${pattern}`)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)[0] ?? null;

const newestTag = newestTagMatching(`${SCOPE}*@*`);
if (!newestTag) {
  console.log('check-changeset: no release tags yet — skipping.');
  process.exit(0);
}
const baseline = git('rev-list', '-n', '1', newestTag);
if (!baseline) {
  console.log('check-changeset: cannot resolve baseline commit — skipping.');
  process.exit(0);
}

// Publishable @flare-engine/* packages (skip private + ignored).
const pkgs = {};
for (const dir of readdirSync(PACKAGES_DIR)) {
  const pj = join(PACKAGES_DIR, dir, 'package.json');
  if (!existsSync(pj)) continue;
  const j = JSON.parse(readFileSync(pj, 'utf8'));
  if (!j.name?.startsWith(SCOPE)) continue;
  const short = j.name.slice(SCOPE.length);
  if (j.private || IGNORE.has(short)) continue;
  pkgs[short] = { name: j.name, version: j.version };
}

// Publishable-package src changed since the last release (committed + working tree).
const changedPkgs = new Set();
for (const f of git('diff', '--name-only', baseline, '--', 'packages').split('\n')) {
  const m = f.trim().match(/^packages\/([^/]+)\/src\//);
  if (m && pkgs[m[1]]) changedPkgs.add(m[1]);
}
if (changedPkgs.size === 0) {
  console.log('check-changeset: no publishable src changed since last release — OK.');
  process.exit(0);
}

// Packages named by a pending changeset.
const covered = new Set();
const csDir = join(ROOT, '.changeset');
if (existsSync(csDir)) {
  for (const f of readdirSync(csDir)) {
    if (!f.endsWith('.md') || f === 'README.md') continue;
    const fm = readFileSync(join(csDir, f), 'utf8').split('---')[1] ?? '';
    for (const line of fm.split('\n')) {
      const m = line.match(/["']@flare-engine\/([\w-]+)["']\s*:/);
      if (m) covered.add(m[1]);
    }
  }
}

const releasedVersion = (short) => {
  const t = newestTagMatching(`${SCOPE}${short}@*`);
  return t ? t.slice(t.lastIndexOf('@') + 1) : null;
};

const uncovered = [];
for (const short of changedPkgs) {
  if (covered.has(short)) continue;
  const tagV = releasedVersion(short);
  if (tagV === null) continue; // never released → inherently pending
  if (pkgs[short].version !== tagV) continue; // already bumped → release pending
  uncovered.push(short);
}

if (uncovered.length > 0) {
  console.error('\ncheck-changeset: FAILED — publishable src changed with no changeset:');
  for (const s of uncovered.sort()) {
    console.error(`  ${SCOPE}${s}  — add one with \`bunx changeset\``);
  }
  console.error('\nFor a truly non-shippable src change, use `bunx changeset --empty`.\n');
  process.exit(1);
}

console.log(`check-changeset: OK — ${changedPkgs.size} changed package(s), all covered.`);
process.exit(0);
