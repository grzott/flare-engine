/**
 * check-publish-safety — release preflight run by `bun run release` after
 * `changeset version` (deps concretized), before `changeset publish`. Guards the
 * publish path against shipping a broken manifest. For every package that
 * `changeset publish` would actually publish, it fails on:
 *
 *   - any `workspace:` range in dependencies / peerDependencies /
 *     optionalDependencies / devDependencies — concretize-workspace-deps must
 *     have rewritten these to `^x.y.z`; a leaked `workspace:` ships an
 *     uninstallable dependency (bun.lock is stale + npm can't transform it),
 *   - version `0.0.0` or missing — a never-versioned package,
 *   - no `exports` and no `main` — nothing for a consumer to import.
 *
 * The publish set MIRRORS `changeset publish`: every workspace package (root
 * `workspaces` globs — packages/*, benchmarks, apps/*) that is NOT `private` and
 * NOT in the changeset `ignore` list. Scanning ALL workspaces (not just
 * packages/*) matters because benchmarks + apps/* carry live `workspace:*` deps
 * today guarded ONLY by their `private` flag — flip one non-private without this
 * and it would publish an uninstallable manifest.
 *
 * Safe to run at HEAD too: all internal deps are `^x.y.z` today, so concretize
 * is a no-op and this passes. create-flare-app is `private` until the launch
 * flip — OSS-F1's runbook flips it to `private:false` — so it is intentionally
 * skipped here and surfaced as a tracking note, not a failure.
 *
 * Bun-runnable plain ESM. Exit 1 on any violation, 0 when the publish set is
 * safe.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies'];

// Every workspace package.json, resolved from the root `workspaces` globs so the
// scan can never silently miss a workspace (packages/*, benchmarks, apps/*).
const workspaceManifests = () => {
  const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const paths = [];
  for (const glob of rootPkg.workspaces ?? []) {
    if (glob.endsWith('/*')) {
      const parent = join(ROOT, glob.slice(0, -2));
      if (!existsSync(parent)) continue;
      for (const d of readdirSync(parent).sort()) {
        const pj = join(parent, d, 'package.json');
        if (existsSync(pj)) paths.push(pj);
      }
    } else {
      const pj = join(ROOT, glob, 'package.json');
      if (existsSync(pj)) paths.push(pj);
    }
  }
  return paths;
};

// Packages changesets is configured to never publish (e.g. @flare-engine/benchmarks).
const changesetIgnored = () => {
  const cfg = join(ROOT, '.changeset', 'config.json');
  if (!existsSync(cfg)) return new Set();
  const { ignore } = JSON.parse(readFileSync(cfg, 'utf8'));
  return new Set(ignore ?? []);
};

const ignored = changesetIgnored();
const violations = [];
const notes = [];
let publishCount = 0;

for (const pj of workspaceManifests()) {
  const j = JSON.parse(readFileSync(pj, 'utf8'));
  if (!j.name) continue;

  if (j.private || ignored.has(j.name)) {
    if (j.private && j.publishConfig?.access === 'public') {
      notes.push(
        `${j.name} is private with publishConfig.access:"public" — intentional; flipped to private:false at launch by OSS-F1.`,
      );
    }
    continue;
  }

  publishCount += 1;

  for (const field of DEP_FIELDS) {
    for (const [dep, range] of Object.entries(j[field] ?? {})) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        violations.push(
          `${j.name}: ${field}.${dep} = "${range}" — must be concretized to ^x.y.z before publish`,
        );
      }
    }
  }

  if (!j.version || j.version === '0.0.0') {
    violations.push(`${j.name}: version is "${j.version ?? 'missing'}" — never versioned`);
  }

  if (!j.exports && !j.main) {
    violations.push(`${j.name}: no "exports" or "main" — nothing for a consumer to import`);
  }
}

for (const n of notes) console.log(`check-publish-safety: NOTE — ${n}`);

if (violations.length > 0) {
  console.error('\ncheck-publish-safety: FAILED — publish set is not safe to ship:');
  for (const v of violations) console.error(`  ${v}`);
  console.error('');
  process.exit(1);
}

console.log(`check-publish-safety: OK — ${publishCount} publishable package(s), all safe to ship.`);
process.exit(0);
