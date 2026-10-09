#!/usr/bin/env bun
/**
 * flip-access — flip the scoped `@flare-engine/*` packages from RESTRICTED to
 * PUBLIC npm access. This is step 3 of the flip runbook (docs/plans/flip-runbook.md)
 * and is effectively ONE-WAY: npm visibility is retroactive across every published
 * version, so run the dry-run first and only `--execute` on flip day.
 *
 * The target set is derived from the workspace at runtime (every packages/*
 * whose name starts with `@flare-engine/` and is not `private`), so it stays
 * correct if a package is added or removed. The scaffolder is in the set: it is
 * `@flare-engine/create`, published restricted from 0.4.0 like the rest.
 *
 * Usage:
 *   bun scripts/flip-access.mjs                 # dry-run (default): list the packages, mutate nothing
 *   bun scripts/flip-access.mjs --execute       # live: `npm access set status=public <pkg>` serially
 *   bun scripts/flip-access.mjs --execute --otp 123456   # pass a 2FA one-time password through
 *
 * Serial + resumable: before each set, the package's current status is probed
 * (`npm access get status <pkg>`) and already-public packages are SKIPPED, so a
 * re-run after a mid-list failure (expired OTP, network) continues where it left
 * off. Setting public on an already-public package is a no-op regardless, so the
 * probe is an optimization, not a correctness requirement. Fail-fast: the first
 * `set` error stops the run (exit 1) — fix auth/OTP and re-run to resume.
 *
 * Exit codes: 0 = done (or dry-run) · 1 = a live set failed · 2 = usage/setup error.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const argv = process.argv.slice(2);

const execute = argv.includes('--execute') || argv.includes('--yes');
const otpIndex = argv.indexOf('--otp');
const otp = otpIndex !== -1 ? argv[otpIndex + 1] : undefined;
if (otpIndex !== -1 && !otp) {
  console.error('[flip-access] --otp needs a value, e.g. --otp 123456');
  process.exit(2);
}

// --- Derive the target set ---------------------------------------------------

const packagesDir = join(root, 'packages');
if (!existsSync(packagesDir)) {
  console.error('[flip-access] packages/ not found — run from the repo root');
  process.exit(2);
}

const scoped = [];
for (const name of readdirSync(packagesDir)) {
  const manifestPath = join(packagesDir, name, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (typeof pkg.name === 'string' && pkg.name.startsWith('@flare-engine/') && !pkg.private) {
    scoped.push(pkg.name);
  }
}
scoped.sort();

if (scoped.length === 0) {
  console.error('[flip-access] no publishable @flare-engine/* packages found');
  process.exit(2);
}

// --- npm helpers -------------------------------------------------------------

const npm = (...args) =>
  execFileSync('npm', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

const currentStatus = (pkg) => {
  try {
    // npm >=9 keys the result by package name: `{ "<pkg>": "public" | "private" }`
    // (a restricted package reports "private"). Parse the value, not the raw line —
    // the human form prints "<pkg>: public", so a bare `=== "public"` never matches.
    const parsed = JSON.parse(npm('access', 'get', 'status', pkg, '--json'));
    const status = parsed[pkg] ?? Object.values(parsed)[0];
    return typeof status === 'string' ? status.toLowerCase() : 'unknown';
  } catch {
    return 'unknown';
  }
};

// --- Dry-run -----------------------------------------------------------------

if (!execute) {
  console.log(`[flip-access] DRY-RUN — ${scoped.length} scoped package(s) would be set public:\n`);
  for (const pkg of scoped) {
    console.log(`  npm access set status=public ${pkg}${otp ? ` --otp=${otp}` : ''}`);
  }
  console.log('\nNothing was changed. Re-run with --execute (flip day only) to apply.');
  process.exit(0);
}

// --- Live --------------------------------------------------------------------

console.log(
  `[flip-access] EXECUTE — flipping ${scoped.length} scoped package(s) to public (serial)\n`,
);
let flipped = 0;
let skipped = 0;
for (const pkg of scoped) {
  if (currentStatus(pkg) === 'public') {
    console.log(`  SKIP  ${pkg} (already public)`);
    skipped++;
    continue;
  }
  try {
    const args = ['access', 'set', 'status=public', pkg];
    if (otp) args.push(`--otp=${otp}`);
    npm(...args);
    console.log(`  OK    ${pkg}`);
    flipped++;
  } catch (err) {
    console.error(`  FAIL  ${pkg}`);
    console.error(String(err.stderr || err.message || err).trim());
    console.error(
      `\n[flip-access] stopped at ${pkg} (${flipped} flipped, ${skipped} already public). ` +
        'Fix the error (often an expired --otp) and re-run — completed packages are skipped.',
    );
    process.exit(1);
  }
}

console.log(
  `\n[flip-access] done — ${flipped} flipped, ${skipped} already public, ${scoped.length} total.`,
);
process.exit(0);
