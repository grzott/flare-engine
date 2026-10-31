#!/usr/bin/env bun
/**
 * classify-pr-risk — decides whether a pull request may merge on green checks
 * (`auto`) or has to wait for the owner's approval (`held`).
 *
 * The policy lives in `.github/risk-policy.json`; this file is the mechanism.
 * A PR is held when any of these is true, and every reason is reported:
 *
 *   - it deletes or renames a file;
 *   - it touches a held path (harness, workflows, agent rules, licences,
 *     release metadata, the gates themselves);
 *   - a changed line under an export-scope glob starts with `export` — the
 *     cheap, conservative proxy for "the public API moved";
 *   - anyone but a dependency bot changes a manifest or the lockfile;
 *   - a dependency is added or removed, or its range takes a major step (for
 *     `0.x`, a minor step), or a manifest field outside the dependency maps
 *     changes — these apply to the dependency bot too;
 *   - a changeset is above `patch`;
 *   - the PR carries the `risk:held` label (an owner convenience only — the
 *     merge gate does not trust labels, which any collaborator can remove).
 *
 * BE HONEST ABOUT THE LIMIT: an exported interface's member changes on a line
 * without the `export` keyword, so it classifies as `auto`. The review agent
 * owns that class: its `held` verdict holds the PR through risk-gate.mjs.
 *
 * CLI: bun scripts/classify-pr-risk.mjs --base <sha> --head <sha>
 *        [--labels a,b] [--author login] [--policy .github/risk-policy.json]
 * Prints the verdict as JSON. Exit 0 for both verdicts; 2 on bad arguments.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const EXPORT_LINE = /^\s*export\b/;
const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

function parseVersion(spec) {
  const m = /^[\^~=v]?(\d+)\.(\d+)(?:\.\d+)?/.exec(spec.trim());
  return m ? { major: Number(m[1]), minor: Number(m[2]) } : null;
}

export function isMajorBump(from, to) {
  if (from === to) return false;
  const a = parseVersion(from);
  const b = parseVersion(to);
  // A git URL, tag or workspace protocol cannot be compared; treat a change as major.
  if (!a || !b) return true;
  if (a.major !== b.major) return true;
  return a.major === 0 && a.minor !== b.minor;
}

export function classifyPrRisk(input, policy) {
  const reasons = [];
  const held = policy.heldGlobs.map((g) => new Bun.Glob(g));
  const exportScope = policy.exportScopeGlobs.map((g) => new Bun.Glob(g));
  const manifests = policy.manifestGlobs.map((g) => new Bun.Glob(g));
  const dependencyBot = policy.dependencyBots.includes(input.author);

  if (input.labels.includes('risk:held')) reasons.push('risk:held label');

  for (const f of input.files) {
    if (f.status === 'D') reasons.push(`deletes ${f.path}`);
    if (f.status === 'R') reasons.push(`renames ${f.path}`);
    if (held.some((g) => g.match(f.path))) reasons.push(`held path ${f.path}`);
    // Only a dependency bot may change manifests or the lockfile on green checks, and only
    // through the dependency rules below; anyone else could swap a resolution or an export map.
    if (!dependencyBot && manifests.some((g) => g.match(f.path))) {
      reasons.push(`manifest change ${f.path}`);
    }
    const touchesExport = [...f.added, ...f.removed].some((line) => EXPORT_LINE.test(line));
    if (touchesExport && exportScope.some((g) => g.match(f.path))) {
      reasons.push(`export change in ${f.path}`);
    }
  }

  for (const level of new Set(input.changesetLevels)) {
    if (level !== 'patch') reasons.push(`changeset level ${level}`);
  }

  for (const d of input.depChanges) {
    if (d.from === null) reasons.push(`adds dependency ${d.name}`);
    else if (d.to === null) reasons.push(`removes dependency ${d.name}`);
    else if (isMajorBump(d.from, d.to)) reasons.push(`major bump ${d.name} ${d.from} -> ${d.to}`);
  }

  for (const manifest of input.manifestFieldChanges) {
    reasons.push(`manifest fields changed in ${manifest}`);
  }

  return { risk: reasons.length > 0 ? 'held' : 'auto', reasons };
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function changedLines(base, head, path) {
  const added = [];
  const removed = [];
  for (const line of git(['diff', '-U0', `${base}...${head}`, '--', path]).split('\n')) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added.push(line.slice(1));
    else if (line.startsWith('-')) removed.push(line.slice(1));
  }
  return { added, removed };
}

function showJson(rev, path) {
  try {
    return JSON.parse(git(['show', `${rev}:${path}`]));
  } catch {
    return null;
  }
}

function withoutDependencies(manifest) {
  const rest = { ...manifest };
  for (const field of DEP_FIELDS) delete rest[field];
  return JSON.stringify(rest);
}

export function collectInput(base, head, labels, author) {
  const files = [];
  const changesetLevels = [];
  const depChanges = [];
  const manifestFieldChanges = [];

  for (const row of git(['diff', '--name-status', '-M', `${base}...${head}`]).split('\n')) {
    if (!row.trim()) continue;
    const [code, first, second] = row.split('\t');
    const status = code[0];
    if (status === 'R') {
      files.push({ path: first, status: 'R', added: [], removed: [] });
      files.push({ path: second, status: 'A', ...changedLines(base, head, second) });
      continue;
    }
    if (status === 'D') {
      files.push({ path: first, status: 'D', added: [], removed: [] });
      continue;
    }
    files.push({
      path: first,
      status: status === 'A' ? 'A' : 'M',
      ...changedLines(base, head, first),
    });

    if (/^\.changeset\/[^/]+\.md$/.test(first) && !first.endsWith('README.md')) {
      const body = git(['show', `${head}:${first}`]);
      const front = /^---\n([\s\S]*?)\n---/.exec(body.replace(/\r\n/g, '\n'));
      for (const m of (front?.[1] ?? '').matchAll(/:\s*(patch|minor|major)\s*$/gm)) {
        changesetLevels.push(m[1]);
      }
    }

    if (first.endsWith('package.json') && status === 'M') {
      const before = showJson(base, first);
      const after = showJson(head, first);
      if (!before || !after) continue;
      for (const field of DEP_FIELDS) {
        const was = before[field] ?? {};
        const now = after[field] ?? {};
        for (const name of new Set([...Object.keys(was), ...Object.keys(now)])) {
          const from = was[name] ?? null;
          const to = now[name] ?? null;
          if (from !== to) depChanges.push({ manifest: first, name, from, to });
        }
      }
      if (withoutDependencies(before) !== withoutDependencies(after)) {
        manifestFieldChanges.push(first);
      }
    }
  }

  return { files, changesetLevels, depChanges, manifestFieldChanges, labels, author: author ?? '' };
}

function argValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const base = argValue(argv, '--base');
  const head = argValue(argv, '--head');
  if (!base || !head) {
    console.error(
      'usage: classify-pr-risk --base <sha> --head <sha> [--labels a,b] [--author login] [--policy path]',
    );
    process.exit(2);
  }
  const labels = (argValue(argv, '--labels') ?? '').split(',').filter(Boolean);
  const policy = JSON.parse(
    readFileSync(argValue(argv, '--policy') ?? '.github/risk-policy.json', 'utf8'),
  );
  console.log(
    JSON.stringify(
      classifyPrRisk(collectInput(base, head, labels, argValue(argv, '--author')), policy),
    ),
  );
}
