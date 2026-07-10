/**
 * check-deps-tiers — CI guardrail for the @flare-engine/* dependency graph.
 *
 * Three checks over every packages/*:
 *   1. PHANTOM deps — declared in package.json (deps + peerDeps) but never
 *      imported from src (.ts/.tsx/.mts/.cts).
 *   2. MISSING deps — imported from src but not declared.
 *   3. UPWARD tier violations — a package depending on a strictly-higher tier,
 *      breaking the downward-only rule. `@flare-engine/engine` is the sanctioned
 *      umbrella barrel: it may depend on anything, but its own deps are still
 *      required to point downward from every OTHER package's perspective.
 *
 * Phantom and missing are both errors. Exit 1 on any violation, 0 when clean.
 * Bun-runnable plain ESM.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const SCOPE = '@flare-engine/';

/**
 * Intentional exceptions. Each entry silences one check for one package.
 * Kind is 'phantom' | 'missing' | 'tier'. Start empty; add only with a comment
 * explaining why the exception is legitimate.
 * @type {Array<{ pkg: string, dep: string, kind: 'phantom' | 'missing' | 'tier' }>}
 */
const ALLOWLIST = [];

/**
 * Lower number = lower tier. A package may depend only on EQUAL-or-lower tier.
 * MUST list every scoped @flare-engine/* package — an unmapped scoped package is a
 * hard error below (it would otherwise silently escape the downward-only tier gate).
 */
const LAYER_MAP = {
  math: 0,
  events: 0,
  core: 1,
  ecs: 1,
  render: 2,
  input: 2,
  physics: 2,
  audio: 2,
  assets: 2,
  simulation: 2,
  shapes: 2,
  progression: 2,
  storage: 2.5,
  errors: 2.5,
  testing: 2.5,
  localization: 2.5,
  'deep-links': 2.5,
  share: 2.5,
  a11y: 2.5,
  haptics: 2.5,
  scene: 3,
  animation: 3,
  particles: 3,
  tilemap: 3,
  debug: 3,
  pathfinding: 3,
  dialogue: 3,
  devtools: 3,
  ui: 3.5,
  postfx: 3.5,
  'ui-shop': 3.5,
  leaderboards: 3.5,
  achievements: 3.5,
  iap: 3.5,
  analytics: 3.5,
  'iap-revenuecat': 3.5,
  react: 4,
  engine: 4,
  'render-web': 4,
  cli: 4,
};

/** The sanctioned umbrella barrel — skipped for its own equal/upward check. */
const UMBRELLA = 'engine';

/** Strip // line comments and /* *\/ block comments so they never match imports. */
const stripComments = (src) => {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      i += 2;
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      out += c;
      i += 1;
      while (i < n) {
        const q = src[i];
        out += q;
        i += 1;
        if (q === '\\') {
          if (i < n) {
            out += src[i];
            i += 1;
          }
          continue;
        }
        if (q === quote) break;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
};

/** Collect the @flare-engine/* package names actually imported from source. */
const importPattern = /(?:from|import)\s*\(?\s*['"]@flare-engine\/([\w-]+)['"]/g;

const collectSourceImports = (srcDir) => {
  const found = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(?:ts|tsx|mts|cts)$/.test(full)) continue;
      const code = stripComments(readFileSync(full, 'utf8'));
      let m;
      importPattern.lastIndex = 0;
      // biome-ignore lint/suspicious/noAssignInExpressions: standard regex exec loop
      while ((m = importPattern.exec(code)) !== null) {
        found.add(m[1]);
      }
    }
  };
  if (existsSync(srcDir)) walk(srcDir);
  return found;
};

const shortName = (fullDepName) => fullDepName.slice(SCOPE.length);

const isAllowed = (pkg, dep, kind) =>
  ALLOWLIST.some((e) => e.pkg === pkg && e.dep === dep && e.kind === kind);

// ── Load every package: declared @flare-engine/* deps + actual src imports. ──
const pkgDirs = readdirSync(PACKAGES_DIR).filter((d) =>
  existsSync(join(PACKAGES_DIR, d, 'package.json')),
);

const packages = [];
for (const dir of pkgDirs) {
  const pkgJsonPath = join(PACKAGES_DIR, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const declared = new Set();
  for (const field of ['dependencies', 'peerDependencies']) {
    const block = pkg[field];
    if (!block) continue;
    for (const name of Object.keys(block)) {
      if (name.startsWith(SCOPE)) declared.add(shortName(name));
    }
  }
  const imported = collectSourceImports(join(PACKAGES_DIR, dir, 'src'));
  packages.push({ dir, name: pkg.name ?? dir, declared, imported });
}

// ── Run the three checks. ──
const phantoms = [];
const missing = [];
const upward = [];
const unmapped = [];

for (const p of packages) {
  const selfShort = basename(p.dir);
  const selfTier = LAYER_MAP[selfShort];
  const isScoped = typeof p.name === 'string' && p.name.startsWith(SCOPE);

  for (const dep of p.declared) {
    if (!p.imported.has(dep) && !isAllowed(p.dir, dep, 'phantom')) {
      phantoms.push({ pkg: p.dir, dep });
    }
  }

  for (const dep of p.imported) {
    if (!p.declared.has(dep) && !isAllowed(p.dir, dep, 'missing')) {
      missing.push({ pkg: p.dir, dep });
    }
  }

  // Tier rule: engine (umbrella) is exempt from its own equal/upward check, but
  // its declared deps are still validated below via every other package's view.
  if (selfShort === UMBRELLA) continue;
  if (selfTier === undefined) {
    // A scoped package with no tier would silently escape the downward-only gate.
    if (isScoped) unmapped.push({ pkg: p.dir, name: p.name });
    continue;
  }
  for (const dep of p.declared) {
    const depTier = LAYER_MAP[dep];
    if (depTier === undefined) continue;
    if (depTier > selfTier && !isAllowed(p.dir, dep, 'tier')) {
      upward.push({ pkg: p.dir, dep, selfTier, depTier });
    }
  }
}

// ── Report. ──
let failed = false;

if (phantoms.length > 0) {
  failed = true;
  console.error(`\nPHANTOM deps (declared but never imported) — ${phantoms.length}:`);
  for (const { pkg, dep } of phantoms) {
    console.error(`  ${pkg}  declares  ${SCOPE}${dep}  but src never imports it`);
  }
}

if (missing.length > 0) {
  failed = true;
  console.error(`\nMISSING deps (imported but not declared) — ${missing.length}:`);
  for (const { pkg, dep } of missing) {
    console.error(`  ${pkg}  imports  ${SCOPE}${dep}  but package.json omits it`);
  }
}

if (upward.length > 0) {
  failed = true;
  console.error(`\nUPWARD tier violations (dep tier > package tier) — ${upward.length}:`);
  for (const { pkg, dep, selfTier, depTier } of upward) {
    console.error(
      `  ${pkg} (tier ${selfTier})  ->  ${SCOPE}${dep} (tier ${depTier})  breaks downward-only rule`,
    );
  }
}

if (unmapped.length > 0) {
  failed = true;
  console.error(`\nUNMAPPED scoped packages (no LAYER_MAP tier) — ${unmapped.length}:`);
  for (const { pkg, name } of unmapped) {
    console.error(
      `  ${pkg} (${name})  has no LAYER_MAP entry — add its tier so the downward-only rule applies`,
    );
  }
}

if (failed) {
  console.error('\ncheck-deps-tiers: FAILED\n');
  process.exit(1);
}

console.log('check-deps-tiers: OK — no phantom/missing deps, no upward tier violations');
