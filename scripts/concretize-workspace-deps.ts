/**
 * concretize-workspace-deps — rewrite internal `workspace:*` ranges to `^<version>`.
 *
 * Run AFTER `changeset version`, BEFORE publish. `changeset version` bumps each
 * package's `version` but leaves internal deps as the `workspace:*` protocol, which
 * is resolved at publish time by the package manager. That resolution is unreliable
 * here: bun reads a stale version from `bun.lock` (changeset version doesn't update
 * the lockfile), and `@changesets/cli` may fall back to `npm publish`, which can't
 * transform `workspace:*` at all and would publish it literally. Both ship broken
 * deps. Concretizing to `^<version>` in `package.json` makes the published manifest
 * correct regardless of publisher or lockfile state; local dev still links because
 * the local version satisfies the caret range.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const packageJsonPaths = readdirSync(PACKAGES_DIR)
  .map((dir) => join(PACKAGES_DIR, dir, 'package.json'))
  .filter((path) => existsSync(path));

const versions = new Map<string, string>();
for (const path of packageJsonPaths) {
  const pkg = JSON.parse(readFileSync(path, 'utf8')) as { name?: string; version?: string };
  if (pkg.name?.startsWith('@flare-engine/') && pkg.version) {
    versions.set(pkg.name, pkg.version);
  }
}

let changedDeps = 0;
let changedFiles = 0;
for (const path of packageJsonPaths) {
  let text = readFileSync(path, 'utf8');
  let fileChanged = false;
  for (const [name, version] of versions) {
    const re = new RegExp(`("${escapeRegExp(name)}"\\s*:\\s*)"workspace:[^"]*"`, 'g');
    text = text.replace(re, (_match, prefix: string) => {
      fileChanged = true;
      changedDeps += 1;
      return `${prefix}"^${version}"`;
    });
  }
  if (fileChanged) {
    writeFileSync(path, text);
    changedFiles += 1;
  }
}

console.log(
  `concretize-workspace-deps: rewrote ${changedDeps} workspace:* deps across ${changedFiles} package.json files`,
);
