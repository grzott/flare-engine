/**
 * check-exports — run `publint` + `@arethetypeswrong/cli` against every
 * publishable package's built output. This is the standard gate for
 * hand-authored `exports` maps going public: publint validates the manifest
 * (files/exports/bin coherence) and attw validates that the dual CJS/ESM types
 * resolve for Node16/nodenext consumers from both `import` and `require`.
 *
 * Requires `bun run build` first (attw analyzes `dist/`). Run in CI after build
 * and before publish (release.yml). The "export set" is every `packages/*` with
 * a name, EXCEPT `benchmarks` — the scaffolder `@flare-engine/create` included.
 *
 * Tools are resolved to their bin entry and spawned through the running bun
 * binary (`process.execPath <bin>`) so there is no Windows PATH / `.cmd`
 * resolution trap and no per-call `bun x` overhead. Packages run through a
 * CPU-scaled worker pool (attw packs + analyses each tarball; serial is too
 * slow for 41 packages). Exit 1 if any package fails either check.
 */
import { execFile } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const pexec = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const BUN = process.execPath;
const IGNORE = new Set(['benchmarks']);

// Resolve a devDep's bin entry to an absolute JS path (dodges Windows `.cmd`).
const resolveBin = (pkgName, binName) => {
  const manifest = require.resolve(`${pkgName}/package.json`);
  const { bin } = JSON.parse(readFileSync(manifest, 'utf8'));
  const rel = typeof bin === 'string' ? bin : bin[binName];
  return join(dirname(manifest), rel);
};

const PUBLINT = resolveBin('publint', 'publint');
const ATTW = resolveBin('@arethetypeswrong/cli', 'attw');

const packages = [];
for (const dir of readdirSync(PACKAGES_DIR).sort()) {
  const pj = join(PACKAGES_DIR, dir, 'package.json');
  if (!existsSync(pj) || IGNORE.has(dir)) continue;
  const j = JSON.parse(readFileSync(pj, 'utf8'));
  if (!j.name) continue;
  const abs = join(PACKAGES_DIR, dir);
  if (!existsSync(join(abs, 'dist'))) {
    console.error(`check-exports: ${j.name} has no dist/ — run \`bun run build\` first.`);
    process.exit(1);
  }
  packages.push({ name: j.name, dir: abs });
}

const runTool = async (bin, args, cwd) => {
  try {
    await pexec(BUN, [bin, ...args], { cwd, maxBuffer: 32 * 1024 * 1024 });
    return { ok: true, out: '' };
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() };
  }
};

const results = new Array(packages.length);
const failures = [];
let cursor = 0;

const worker = async () => {
  while (cursor < packages.length) {
    const i = cursor++;
    const { name, dir } = packages[i];
    const publint = await runTool(PUBLINT, [], dir);
    const attw = await runTool(ATTW, ['--pack', '.', '--profile', 'node16'], dir);
    results[i] = { name, ok: publint.ok && attw.ok };
    if (!publint.ok) failures.push({ name, tool: 'publint', out: publint.out });
    if (!attw.ok) failures.push({ name, tool: 'attw', out: attw.out });
  }
};

const concurrency = Math.max(2, Math.min(packages.length, cpus().length - 1));
await Promise.all(Array.from({ length: concurrency }, worker));

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);

if (failures.length > 0) {
  console.error('\ncheck-exports: FAILED');
  for (const f of failures.sort((a, b) => a.name.localeCompare(b.name))) {
    console.error(`\n--- ${f.name} (${f.tool}) ---`);
    console.error(f.out || '(no output)');
  }
  console.error('');
  process.exit(1);
}

console.log(`\ncheck-exports: OK — ${packages.length} package(s) passed publint + attw.`);
process.exit(0);
