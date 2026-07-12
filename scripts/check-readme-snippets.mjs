/**
 * check-readme-snippets — prove that every ts / tsx example inside a package
 * README (packages/<pkg>/README.md) actually typechecks against the workspace.
 * Public docs that lie (wrong import path, renamed export, wrong argument shape)
 * are worse than no docs; this is the gate that keeps them honest (the OSS-D1
 * finding: README examples fail to compile in ~24 of 41 packages).
 *
 * Approach — one project, one tsc:
 *   1. Derive a "@flare-engine/<pkg>" -> "packages/<pkg>/src/<entry>.ts" paths
 *      map from each package's `exports` field (root -> src/index.ts; a subpath
 *      export like "./headless" -> src/headless.ts). Snippets typecheck against
 *      the workspace SOURCE, not dist, so NO build is required and the check
 *      matches the package-src typecheck context.
 *   2. Extract each fenced ts/tsx block into its own virtual file with a trailing
 *      "export {};" appended so every snippet is an isolated ES module — snippets
 *      can never share top-level scope, and top-level `await` is legal.
 *   3. Typecheck all snippets in one `tsc --noEmit` pass, then map each diagnostic
 *      back to its "README.md:<line>" for the D2-D4 fixer worklist.
 *
 * Poison handling — the hard part. tsc is all-or-nothing: if ANY file in the
 * program has a syntactic (parse) error, tsc reports only syntactic diagnostics
 * and skips SEMANTIC checking for the ENTIRE program (verified real). A single
 * snippet with a broken arrow would otherwise mask every other package's errors
 * and greenwash the whole inventory. So we plant a liveness CANARY: a file with a
 * deliberate SEMANTIC error (TS2322). After each tsc run, if the canary's error is
 * present the semantic pass ran and the inventory is trustworthy; if it's ABSENT
 * the run was poisoned (or tsc failed to launch / truncated), so we drop the
 * snippet(s) tsc flagged and re-run — and if the poison can't be attributed to a
 * snippet (a parse error in workspace source, a bad tsc invocation, an option
 * error), we ABORT LOUD (exit 2) rather than default to all-green. tsc is the sole
 * syntax authority, so there are no parser-divergence false failures.
 *
 * Opt-out: a fence tagged "ts no-check" is extracted-but-skipped, for
 * intentionally partial fragments. Use sparingly — the goal is compiling docs.
 *
 * Strictness: `strict: true` only. Snippets are consumer-facing, so they are NOT
 * held to the engine's internal `noUncheckedIndexedAccess` / `verbatimModuleSyntax`
 * (a consumer's tsconfig need not enable those); `strict` still catches the things
 * that make docs lie — missing imports, wrong argument types, and typos.
 *
 * The `lib` is ES2022 + DOM (explicit) because the engine targets Web AND React
 * Native, and web-facing snippets (render-web, audio, input, share) legitimately
 * reference DOM types (HTMLCanvasElement, AudioContext, window, File). One known
 * limitation follows: a snippet's free variable that happens to be named like a
 * Window value-global (name/length/status/close/open/find/event/location/...) is
 * satisfied by the DOM lib and won't be flagged. That is an accepted gap — the
 * D-passes make snippets self-contained regardless, and dropping DOM would
 * false-FAIL the legitimate web-type snippets above.
 *
 * Bun-runnable plain ESM. Exit 1 if any checked snippet fails to typecheck; exit 2
 * on a harness error (tsc semantic pass never ran).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const GEN_DIR = join(ROOT, 'scripts', 'readme-snippets');
const TSCONFIG = join(GEN_DIR, 'tsconfig.json');
const CANARY = '__liveness__.ts';
const BUN = process.execPath;
const IGNORE = new Set(['benchmarks']);

const toPosix = (p) => p.replace(/\\/g, '/');

// Reverse a package export target (`./dist/headless.d.mts`) to its src file base
// (`headless`). Falls back to the export key, then to `index`.
const srcBaseFor = (key, entry) => {
  const target =
    typeof entry === 'string'
      ? entry
      : (entry?.import?.types ??
        entry?.require?.types ??
        entry?.types ??
        entry?.import?.default ??
        entry?.default);
  if (typeof target === 'string') {
    const m = target.match(/dist\/(.+?)\.(?:d\.m?ts|d\.cts|m?js|cjs)$/);
    if (m) return m[1];
  }
  return key === '.' ? 'index' : key.replace(/^\.\//, '');
};

// Public specifier for an export key: bare name for '.', name/sub otherwise.
const specFor = (name, key) => (key === '.' ? name : `${name}/${key.slice(2)}`);

const packages = [];
for (const dir of readdirSync(PACKAGES_DIR).sort()) {
  const pj = join(PACKAGES_DIR, dir, 'package.json');
  if (!existsSync(pj) || IGNORE.has(dir)) continue;
  const manifest = JSON.parse(readFileSync(pj, 'utf8'));
  if (!manifest.name) continue;
  packages.push({
    dir,
    name: manifest.name,
    exports: manifest.exports,
    readme: join(PACKAGES_DIR, dir, 'README.md'),
  });
}

// Build the paths map from every package's declared export entries. A ROOT ('.')
// key whose src is missing falls back to index.ts (every package has one); a
// SUBPATH key whose src is missing is left pointing at the derived (missing) path
// so a broken subpath import honestly fails as TS2307 rather than being silently
// remapped onto index.ts (which could mask it as a false PASS).
const paths = {};
for (const pkg of packages) {
  const ex = pkg.exports;
  const keys =
    ex && typeof ex === 'object'
      ? Object.keys(ex).filter(
          (k) => k.startsWith('.') && k !== './package.json' && !k.includes('*'),
        )
      : [];
  if (keys.length === 0) keys.push('.');
  for (const key of keys) {
    const base = srcBaseFor(key, ex && typeof ex === 'object' ? ex[key] : ex);
    let rel = join('packages', pkg.dir, 'src', `${base}.ts`);
    if (!existsSync(join(ROOT, rel))) {
      console.error(
        `check-readme: WARN ${specFor(pkg.name, key)} -> ${toPosix(rel)} does not exist`,
      );
      if (key === '.') rel = join('packages', pkg.dir, 'src', 'index.ts');
    }
    paths[specFor(pkg.name, key)] = [toPosix(rel)];
  }
}

// Extract every ts/tsx fenced block from a README. Records the 1-based README line
// of the block's first code line (diagnostics anchor there). Accepts the common
// `typescript` alias case-insensitively so a differently-tagged fence is never
// silently skipped (which would falsely green the package).
const extractSnippets = (readmePath) => {
  if (!existsSync(readmePath)) return [];
  const lines = readFileSync(readmePath, 'utf8').split(/\r?\n/);
  const snippets = [];
  let i = 0;
  while (i < lines.length) {
    const open = lines[i].match(/^```(tsx|ts|typescript)\b(.*)$/i);
    if (!open) {
      i++;
      continue;
    }
    const lang = /^tsx$/i.test(open[1]) ? 'tsx' : 'ts';
    const noCheck = /\bno-check\b/.test(open[2] ?? '');
    i++;
    const firstCodeLine = i + 1;
    const code = [];
    while (i < lines.length && !/^```\s*$/.test(lines[i])) {
      code.push(lines[i]);
      i++;
    }
    i++; // consume the closing fence
    snippets.push({ lang, noCheck, firstCodeLine, code: code.join('\n') });
  }
  return snippets;
};

// Map a 1-based snippet line to its 1-based README line. Diagnostics past the last
// code line land on the appended `export {};` — clamp them to the last code line.
const toReadmeLine = (meta, snippetLine) =>
  snippetLine > meta.codeLines
    ? meta.firstCodeLine + meta.codeLines - 1
    : meta.firstCodeLine + snippetLine - 1;

rmSync(GEN_DIR, { recursive: true, force: true });
mkdirSync(GEN_DIR, { recursive: true });

// Emit one virtual module per checked snippet; remember where each came from.
const byFile = new Map(); // file -> { pkgName, firstCodeLine, codeLines }
const errorsByFile = new Map(); // file -> [{ readmeLine, code, msg }]
const present = new Set(); // snippet files currently written to GEN_DIR
let checkedCount = 0;
let skippedCount = 0;
for (const pkg of packages) {
  pkg.snippets = extractSnippets(pkg.readme);
  let n = 0;
  for (const snip of pkg.snippets) {
    if (snip.noCheck) {
      skippedCount++;
      continue;
    }
    n++;
    checkedCount++;
    const file = `${pkg.dir}__${n}.${snip.lang}`;
    byFile.set(file, {
      pkgName: pkg.name,
      firstCodeLine: snip.firstCodeLine,
      codeLines: snip.code.split('\n').length,
    });
    writeFileSync(join(GEN_DIR, file), `${snip.code}\nexport {};\n`);
    present.add(file);
  }
}

// Liveness canary — a deliberate SEMANTIC error (TS2322). Present in tsc output
// only when the semantic pass actually ran; absent => the run was poisoned by a
// parse error somewhere (or tsc failed / truncated).
writeFileSync(join(GEN_DIR, CANARY), "const __liveness__: number = 'canary';\nexport {};\n");

const tsconfig = {
  compilerOptions: {
    noEmit: true,
    strict: true,
    target: 'ES2022',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    module: 'ESNext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    types: [],
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    baseUrl: toPosix(relative(GEN_DIR, ROOT)) || '.',
    paths,
  },
  include: ['*.ts', '*.tsx'],
};
writeFileSync(TSCONFIG, `${JSON.stringify(tsconfig, null, 2)}\n`);

// Diagnostic line (tsc --pretty false): <path>(<line>,<col>): error TSxxxx: <msg>.
// A generic matcher so we can see EVERY diagnostic — snippet-attributed, canary,
// or foreign (workspace source) — and never mistake a poisoned run for all-green.
const DIAG_RE = /(?:^|[\\/])([^\\/()]+\.tsx?)\((\d+),\d+\): error (TS\d+): (.+)$/;
const runTsc = () => {
  let out = '';
  try {
    execFileSync(BUN, ['x', 'tsc', '--noEmit', '--pretty', 'false', '-p', TSCONFIG], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  const diags = [];
  for (const raw of out.split(/\r?\n/)) {
    const m = raw.match(DIAG_RE);
    if (!m) continue;
    const [, file, lineStr, code, msg] = m;
    diags.push({ file, snippetLine: Number(lineStr), code, msg: msg.trim() });
  }
  return { out, diags };
};

const record = (file, snippetLine, code, msg) => {
  const meta = byFile.get(file);
  if (!errorsByFile.has(file)) errorsByFile.set(file, []);
  errorsByFile.get(file).push({ readmeLine: toReadmeLine(meta, snippetLine), code, msg });
};

// Run to a semantically-live tsc pass, dropping any snippet the poison is
// attributable to. Bounded by the snippet count (each poisoned round drops >=1).
for (let round = 0; round <= present.size + 1; round++) {
  const { out, diags } = runTsc();
  if (diags.some((d) => d.file === CANARY)) {
    for (const d of diags)
      if (byFile.has(d.file) && present.has(d.file)) record(d.file, d.snippetLine, d.code, d.msg);
    break;
  }
  // Poisoned: tsc emitted only syntactic diagnostics. Drop the snippets they hit.
  const poisoners = diags.filter((d) => present.has(d.file));
  if (poisoners.length === 0) {
    console.error('\ncheck-readme: HARNESS ERROR — tsc did not complete a semantic pass');
    console.error(
      '(the liveness canary produced no diagnostic) and the poison is not attributable',
    );
    console.error('to any snippet. Likely a parse error in workspace source reached via the paths');
    console.error('map, a bad tsc invocation, or truncated output. Raw tsc diagnostics:\n');
    console.error(out.trim() || '(no tsc output captured)');
    process.exit(2);
  }
  const dropped = new Set();
  for (const d of poisoners) {
    record(d.file, d.snippetLine, d.code, d.msg);
    if (!dropped.has(d.file)) {
      dropped.add(d.file);
      rmSync(join(GEN_DIR, d.file), { force: true });
      present.delete(d.file);
    }
  }
}

// Aggregate per package.
const perPkg = new Map(); // pkgName -> [{ readmeLine, code, msg }]
for (const [file, errs] of errorsByFile) {
  const { pkgName } = byFile.get(file);
  if (!perPkg.has(pkgName)) perPkg.set(pkgName, []);
  perPkg.get(pkgName).push(...errs);
}

// Report.
console.log('== check:readme — README snippet typecheck ==\n');
let green = 0;
let failing = 0;
let noSnippets = 0;
let totalErrors = 0;
const pad = Math.max(...packages.map((p) => p.name.length));
for (const pkg of packages) {
  const checked = pkg.snippets.filter((s) => !s.noCheck).length;
  const errs = perPkg.get(pkg.name) ?? [];
  totalErrors += errs.length;
  let status;
  if (checked === 0) {
    status = '—   ';
    noSnippets++;
  } else if (errs.length === 0) {
    status = 'PASS';
    green++;
  } else {
    status = 'FAIL';
    failing++;
  }
  const detail =
    checked === 0
      ? '(no checked snippets)'
      : errs.length === 0
        ? `(${checked} snippet${checked === 1 ? '' : 's'})`
        : `(${checked} snippet${checked === 1 ? '' : 's'}, ${errs.length} error${errs.length === 1 ? '' : 's'})`;
  console.log(`${status}  ${pkg.name.padEnd(pad)}  ${detail}`);
}

if (failing > 0) {
  console.log('\n--- Failure inventory (D2-D4 fixer worklist) ---');
  for (const pkg of packages) {
    const errs = perPkg.get(pkg.name);
    if (!errs || errs.length === 0) continue;
    console.log(`\n### ${pkg.name}`);
    for (const e of errs.sort((a, b) => a.readmeLine - b.readmeLine)) {
      console.log(`- README.md:${e.readmeLine}  ${e.code}  ${e.msg}`);
    }
  }
}

console.log(
  `\nSummary: ${green} green, ${failing} failing, ${noSnippets} without snippets ` +
    `(${packages.length} packages). ${checkedCount} snippet${checkedCount === 1 ? '' : 's'} checked, ` +
    `${skippedCount} no-check skipped, ${totalErrors} error${totalErrors === 1 ? '' : 's'}.`,
);

if (failing > 0) {
  console.error('\ncheck-readme: FAILED — README snippets do not typecheck (see inventory above).');
  process.exit(1);
}
console.log('\ncheck-readme: OK — all README snippets typecheck.');
process.exit(0);
