/**
 * scaffold-e2e — scaffold every `@flare-engine/create` template from the BUILT
 * workspace, install it, typecheck it and run its tests.
 *
 * The scaffolder's own suite runs with `skipInstall: true`, so nothing in the
 * repo proves that a template's pins resolve, that its `tsconfig.json` compiles
 * the generated app against the pinned Expo / React Native / Skia, or that its
 * shipped tests pass. This catches a template pin that no longer installs, a
 * generated app that no longer typechecks against its pins or the workspace's
 * current exports, and a failing template test. It does not catch a wrong
 * next-step hint printed by the CLI or a native-build failure (neither runs).
 *
 * Mechanics: `bun pm pack` the workspace closure of every `@flare-engine/*`
 * dependency the templates name (the published artifact, not the source tree),
 * run the built `flare-create` bin for each template into a scratch dir, point
 * the scaffold's scoped dependencies at those tarballs and override the same
 * names for the transitive ranges (`@flare-engine/engine` depends on
 * `@flare-engine/math@^x.y.z`, which must not resolve to a registry copy),
 * then `bun install`, `tsc --noEmit` and `bun run test` where the template has
 * one. The scratch dir is removed afterwards unless `--keep` is passed.
 *
 * The bar is install, typecheck and unit tests: no native build and no Expo
 * start. The install still fetches react-native-skia's native libraries: since
 * 2.6 they are ordinary `react-native-skia-*` dependencies that its postinstall
 * (`scripts/install-libs.js`) copies locally, with no download to skip.
 *
 * Needs `bun run build` first (reads `packages/create/dist/bin.js` and every
 * package's `dist/`) and the npm registry for the templates' third-party pins.
 * Bun-runnable plain ESM. Exit 1 when any template fails, 0 when all pass.
 *
 * Usage: `bun scripts/scaffold-e2e.mjs [--only <template>] [--keep] [--work-dir <dir>]`
 * (`bun run check:scaffold`). `--keep` leaves the scratch dir for inspection;
 * `--work-dir` puts it under `<dir>` instead of the OS temp dir.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES_DIR = join(ROOT, 'packages');
const CREATE_DIR = join(PACKAGES_DIR, 'create');
const TEMPLATES_DIR = join(CREATE_DIR, 'templates');
const BIN = join(CREATE_DIR, 'dist', 'bin.js');
const SCOPE = '@flare-engine/';

const DEP_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

/**
 * Pure: the transitive `@flare-engine/*` closure of `names`, following every
 * dependency field of each workspace manifest, sorted. Names outside the scope
 * are ignored; a scoped name with no workspace manifest throws, since a
 * template naming a package this repo does not ship is itself the defect.
 */
export const flareClosure = (names, manifests) => {
  const seen = new Set();
  const queue = names.filter((n) => n.startsWith(SCOPE));
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name)) continue;
    const manifest = manifests.get(name);
    if (!manifest) throw new Error(`${name} is not a workspace package`);
    seen.add(name);
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(manifest[field] ?? {})) {
        if (dep.startsWith(SCOPE)) queue.push(dep);
      }
    }
  }
  return [...seen].sort();
};

/**
 * Pure: a copy of a scaffolded `package.json` whose `@flare-engine/*` entries
 * point at `file:<tarballsRel>/<tarball>` and whose `overrides` pin every
 * packed name the same way, so the transitive ranges inside the tarballs
 * resolve to the workspace artifacts rather than to the registry. Throws when
 * a scoped dependency has no tarball: leaving its registry range in place
 * would quietly test a published version instead of HEAD.
 */
export const linkToTarballs = (manifest, tarballs, tarballsRel) => {
  const spec = (name) => `file:${tarballsRel}/${tarballs.get(name)}`;
  const out = { ...manifest };
  for (const field of DEP_FIELDS) {
    const deps = manifest[field];
    if (!deps) continue;
    out[field] = { ...deps };
    for (const name of Object.keys(deps)) {
      if (!name.startsWith(SCOPE)) continue;
      if (!tarballs.has(name)) throw new Error(`no tarball packed for ${name}`);
      out[field][name] = spec(name);
    }
  }
  const overrides = { ...(manifest.overrides ?? {}) };
  for (const name of tarballs.keys()) overrides[name] = spec(name);
  out.overrides = overrides;
  return out;
};

/**
 * Pure: the `@flare-engine/*` names a scaffold's `bun.lock` resolved from a
 * registry (a semver resolution such as `"@flare-engine/math@0.4.8"`) rather
 * than from a tarball (`"@flare-engine/math@../tarballs/….tgz"`), sorted. Any
 * entry here means the overrides stopped applying and the run is testing a
 * published version instead of HEAD, so the gate must fail rather than pass.
 */
export const registryResolutions = (lockText) => {
  const names = new Set();
  for (const match of lockText.matchAll(/"(@flare-engine\/[^@"/]+)@\d[^"]*"/g)) names.add(match[1]);
  return [...names].sort();
};

const flagValue = (argv, name) => {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const value = argv[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
};

/**
 * Pure: the CLI options. A value flag with nothing after it, or with another
 * flag after it (`--only --keep`), throws rather than silently running every
 * template or taking the next flag as its value.
 */
export const parseArgs = (argv) => ({
  keep: argv.includes('--keep'),
  only: flagValue(argv, '--only'),
  workDir: flagValue(argv, '--work-dir'),
});

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Every workspace package manifest by name, with the directory it lives in. */
const readWorkspaceManifests = () => {
  const manifests = new Map();
  for (const dir of readdirSync(PACKAGES_DIR)) {
    const path = join(PACKAGES_DIR, dir, 'package.json');
    if (!existsSync(path)) continue;
    const manifest = readJson(path);
    if (typeof manifest.name === 'string') manifests.set(manifest.name, { ...manifest, dir });
  }
  return manifests;
};

/** Template ids: every directory under packages/create/templates. */
const discoverTemplates = () =>
  readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

/**
 * `bun pm pack` one workspace package into `dest`; returns the tarball
 * filename, found as the one new entry in `dest` rather than parsed from the
 * command's output, whose shape differs between bun versions.
 */
const packTarball = (dir, dest) => {
  const before = new Set(readdirSync(dest));
  execFileSync(
    process.execPath,
    ['pm', 'pack', '--ignore-scripts', '--quiet', '--destination', dest],
    {
      cwd: dir,
      stdio: ['ignore', 'ignore', 'inherit'],
    },
  );
  const added = readdirSync(dest).filter((f) => !before.has(f) && f.endsWith('.tgz'));
  return added.length === 1 ? added[0] : undefined;
};

/** Runs a command with inherited stdio; returns its exit status (1 on a spawn error). */
const run = (cmd, args, cwd, env = {}) =>
  spawnSync(cmd, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } }).status ?? 1;

// tsc prints nothing on success, so the success line is what proves it ran.
const step = (template, name, status) => {
  if (status === 0) {
    console.log(`scaffold-e2e: ${template}: ${name} ok`);
    return true;
  }
  console.error(`\nscaffold-e2e: ${template}: ${name} exited with ${status}`);
  return false;
};

/**
 * Scaffold, link, install, typecheck and test one template inside `workDir`.
 * Returns the first failing step's name, or null when every step passed.
 */
const runTemplate = (template, workDir, tarballs) => {
  const appName = `e2e-${template}`;
  const appDir = join(workDir, appName);
  const tarballsRel = relative(appDir, join(workDir, 'tarballs')).split(sep).join('/');

  console.log(`\n==> scaffold-e2e: ${template}`);
  if (
    !step(
      template,
      'flare-create',
      run(
        process.execPath,
        [BIN, appName, '--template', template, '--package-manager', 'bun', '--skip-install'],
        workDir,
      ),
    )
  ) {
    return 'flare-create';
  }

  const manifestPath = join(appDir, 'package.json');
  const linked = linkToTarballs(readJson(manifestPath), tarballs, tarballsRel);
  writeFileSync(manifestPath, `${JSON.stringify(linked, null, 2)}\n`);

  if (!step(template, 'bun install', run(process.execPath, ['install'], appDir))) {
    return 'bun install';
  }

  const fromRegistry = registryResolutions(readFileSync(join(appDir, 'bun.lock'), 'utf8'));
  if (fromRegistry.length > 0) {
    console.error(
      `\nscaffold-e2e: ${template}: resolved from the registry instead of the workspace tarballs: ${fromRegistry.join(', ')}`,
    );
    return 'resolution';
  }
  console.log(`scaffold-e2e: ${template}: every @flare-engine/* package resolved to a tarball`);

  const tsc = join(appDir, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(tsc)) {
    console.error(`\nscaffold-e2e: ${template}: the scaffold installed no typescript (${tsc})`);
    return 'tsc';
  }
  if (!step(template, 'tsc --noEmit', run(process.execPath, [tsc, '--noEmit'], appDir))) {
    return 'tsc';
  }

  if (typeof linked.scripts?.test === 'string') {
    if (!step(template, 'bun run test', run(process.execPath, ['run', 'test'], appDir))) {
      return 'test';
    }
  } else {
    console.log(`scaffold-e2e: ${template}: no test script, skipping tests`);
  }
  return null;
};

if (import.meta.main) {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`scaffold-e2e: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
  const { keep, only } = opts;

  if (!existsSync(BIN)) {
    console.error(`scaffold-e2e: ${relative(ROOT, BIN)} is missing — run \`bun run build\` first.`);
    process.exit(1);
  }

  const templates = discoverTemplates().filter((t) => !only || t === only);
  if (templates.length === 0) {
    console.error(`scaffold-e2e: no template matches ${only ?? '(any)'} under ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  const manifests = readWorkspaceManifests();
  const wanted = new Set();
  for (const template of templates) {
    const manifest = readJson(join(TEMPLATES_DIR, template, 'package.json'));
    for (const field of DEP_FIELDS) {
      for (const name of Object.keys(manifest[field] ?? {})) wanted.add(name);
    }
  }
  const closure = flareClosure([...wanted], manifests);

  // Absolute: `bun pm pack --destination` resolves against the package being packed.
  const workRoot = resolve(opts.workDir ?? tmpdir());
  mkdirSync(workRoot, { recursive: true });
  const workDir = mkdtempSync(join(workRoot, 'flare-scaffold-e2e-'));
  const tarballsDir = join(workDir, 'tarballs');
  mkdirSync(tarballsDir);
  const failures = [];
  try {
    console.log(`scaffold-e2e: packing ${closure.length} workspace package(s) into ${tarballsDir}`);
    const tarballs = new Map();
    for (const name of closure) {
      const { dir } = manifests.get(name);
      const file = packTarball(join(PACKAGES_DIR, dir), tarballsDir);
      // Thrown, not process.exit(): exit skips `finally` and would leak the scratch dir.
      if (!file) throw new Error(`bun pm pack produced no tarball for ${name}`);
      tarballs.set(name, file);
    }

    for (const template of templates) {
      const failed = runTemplate(template, workDir, tarballs);
      if (failed) failures.push(`${template} (${failed})`);
    }
  } catch (err) {
    failures.push(err instanceof Error ? err.message : String(err));
  } finally {
    if (keep) console.log(`\nscaffold-e2e: kept ${workDir}`);
    else rmSync(workDir, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`\nscaffold-e2e: FAILED — ${templates.length} template(s) attempted:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(
    `\nscaffold-e2e: OK — ${templates.join(', ')} scaffolded, installed, typechecked and tested.`,
  );
}
