#!/usr/bin/env bun
/**
 * audit-tarballs — OSS-F3 freeze-time tarball + published-versions audit.
 *
 * The npm access flip (restricted -> public) is RETROACTIVE: it exposes every
 * previously published version (0.1.0, 0.2.0, 0.2.1) as well as HEAD. So this
 * audits the actual tarball bytes — including built `dist/**` `.js`/`.d.ts`,
 * where the "PT-vocab in a shipping .d.ts" launch-blocker class lives — for:
 *
 *   - HIGH   secrets/credentials + local build paths + private URLs
 *   - MEDIUM private-project IP vocabulary (Pan Tvardowski, Berek, folklore names)
 *   - LOW    plan/session references + genre coupling (advisory)
 *
 * It is a DETECTOR, not a scrubber (per road-to-oss §9): it reports hits, never
 * edits. HEAD hits are fix rows; hits in OLD published versions go to the owner
 * for disposition before the flip (the per-hit ledger is written to the _local/
 * report, which is gitignored). It also asserts each HEAD tarball manifest is
 * `license: "Apache-2.0"` and ships both LICENSE + NOTICE (E2). Published
 * 0.1.0-0.2.1 tarballs stay MIT by design (immutable) — recorded, never flagged.
 *
 * Targets: the 40 scoped `@flare-engine/*` (not private) + `create-flare-app`
 * (unscoped, private today, flips public at launch). Absent-at-version is
 * expected (only 36 packages existed at 0.1.0) — recorded n/a, never a failure.
 *
 * The published-version fetch is AUTHENTICATED (restricted packages) and thus
 * owner-paired: without a logged-in npm token every `npm view`/`npm pack
 * <name>@<ver>` 404s/E403s and is recorded "not fetched (auth required)" — the
 * script never crashes, and the HEAD half runs fully offline. Re-run
 * authenticated to fill the published rows and record dispositions.
 *
 * Tarballs are read with a pure-Node gunzip + ustar parser (no external `tar`)
 * so the scan is byte-identical on Windows/macOS/Linux and can't be tripped by
 * GNU-tar-vs-bsdtar path quirks.
 *
 * Usage:
 *   bun scripts/audit-tarballs.mjs                 # HEAD scan + attempt published (needs auth)
 *   bun scripts/audit-tarballs.mjs --head-only     # HEAD scan only (offline, CI/agent)
 *   bun scripts/audit-tarballs.mjs --only math     # restrict targets to names containing "math"
 *   bun scripts/audit-tarballs.mjs --selftest      # prove the detector fires on planted samples
 *
 * Exit codes: 0 = HEAD clean · 1 = HEAD hits (fix rows) or selftest failure ·
 *             2 = usage/setup error.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import {
  declaredEntryPoints,
  discoverPublishTargets,
  npm,
  REPO_ROOT,
  withPackedTarball,
} from './lib/pack.mjs';

const ROOT = REPO_ROOT;
const REPORT_PATH = join(ROOT, 'docs', 'plans', '_local', 'f3-tarball-audit.md');
const PUBLISHED_VERSIONS_EXPECTED = ['0.1.0', '0.2.0', '0.2.1'];
const MAX_SCAN_BYTES = 2 * 1024 * 1024;

// --- Leak patterns -----------------------------------------------------------
// severity: high (must never ship) · medium (private IP) · low (advisory).
// redact: mask the matched value in the report (real secrets).
// skipCreateFlareApp: legitimate in the public starter templates (e.g. "shmup").
const PATTERNS = [
  { category: 'local-path', severity: 'high', re: /C:[\\/]_PROG|flare-engine-workspace/i },
  { category: 'home-path', severity: 'high', re: /(?:\/Users\/|\/home\/)[a-z0-9._-]+\//i },
  { category: 'npm-token', severity: 'high', redact: true, re: /npm_[A-Za-z0-9]{36}/ },
  {
    category: 'gh-token',
    severity: 'high',
    redact: true,
    re: /ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,}/,
  },
  {
    category: 'private-key',
    severity: 'high',
    redact: true,
    // Covers PKCS8/RSA/EC/OPENSSH ("... PRIVATE KEY") and PGP armor ("... PRIVATE KEY BLOCK").
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----/,
  },
  {
    category: 'api-key',
    severity: 'high',
    redact: true,
    re: /AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,}/,
  },
  { category: 'auth-token-ref', severity: 'high', re: /_authToken|NPM_TOKEN|NODE_AUTH_TOKEN/ },
  { category: 'ci-secret', severity: 'high', re: /TESTINGBOT_(?:KEY|SECRET)|EXPO_TOKEN/i },
  {
    category: 'private-url',
    severity: 'high',
    re: /u\.expo\.dev|202e2a64-a737-48c1-8d71-0e7b8b6a3395|grzegorzotto\.dev/i,
  },
  { category: 'pt-vocab', severity: 'medium', re: /pan[\s._-]?tvardowski|tvardowski/i },
  {
    category: 'sibling-repo',
    severity: 'high',
    re: /grzott-portfolio|flare-engine-page|Pan-Tvardowski|pan-tvardowski-lore/i,
  },
  // Unanchored (like pt-vocab) so IP names embedded in identifiers/keys are caught
  // (berekMode, spawnKogut, JedzaBossState); these have no English collision.
  {
    category: 'game-ip',
    severity: 'medium',
    re: /berek|kogut|j[eę]dz[aeęyąói]|polyform/i,
  },
  // "smok" collides with English "smoke/smoky", so match only proper-noun forms
  // (Smok, SmokBoss, spawnSmok, smokBoss, smok_x, x_smok, standalone smok). Case-sensitive.
  {
    category: 'game-ip',
    severity: 'medium',
    re: /Smok(?![a-z])|smok(?=[A-Z])|\bsmok\b|_smok|smok_/,
  },
  {
    category: 'plan-ref',
    severity: 'low',
    re: /SESSION_LOG|road-to-oss|docs[\\/]plans[\\/]_local|(?:^|[^a-z])_local[\\/]/,
  },
  {
    category: 'genre-coupling',
    severity: 'low',
    skipScaffolders: true,
    re: /\bshmup\b|danmaku|bullet[\s-]?hell/i,
  },
];

// The two public scaffolders legitimately name their starter templates
// (blank/topdown/shmup), so genre words there are expected, not coupling leaks.
const SCAFFOLDER_PACKAGES = new Set(['create-flare-app', '@flare-engine/cli']);

// Files that must never appear in a published tarball.
const FORBIDDEN_FILES =
  /(?:^|[\\/])(?:\.npmrc|\.env(?:\.[\w-]+)?|id_rsa|.*\.pem|.*\.key)$|(?:^|[\\/])(?:\.git|node_modules)[\\/]/i;

// --- Tarball read (pure Node: gunzip + ustar parse) --------------------------
const parseOctal = (buf) => {
  const s = buf.toString('ascii').replace(/\0.*$/s, '').trim();
  return s ? Number.parseInt(s, 8) : 0;
};

const isZeroBlock = (block) => {
  for (const b of block) if (b !== 0) return false;
  return true;
};

// Returns [{ name, data }] for regular-file entries only. Handles the GNU
// longname ('L') and pax ('x'/'g') extensions so long paths are not truncated.
const readTarball = (tgzPath) => {
  const raw = gunzipSync(readFileSync(tgzPath));
  const entries = [];
  let override = null;
  let offset = 0;
  while (offset + 512 <= raw.length) {
    const header = raw.subarray(offset, offset + 512);
    if (isZeroBlock(header)) break;
    let name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '');
    if (prefix) name = `${prefix}/${name}`;
    const size = parseOctal(header.subarray(124, 136));
    const type = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    const data = raw.subarray(dataStart, dataStart + size);
    offset = dataStart + Math.ceil(size / 512) * 512;

    if (type === 'L') {
      override = data.toString('utf8').replace(/\0.*$/s, '');
      continue;
    }
    if (type === 'x' || type === 'g') {
      const m = data.toString('utf8').match(/\d+ path=([^\n]+)\n/);
      if (m) override = m[1];
      continue;
    }
    if (override) {
      name = override;
      override = null;
    }
    if (type === '0' || type === '\0') entries.push({ name, data });
  }
  return entries;
};

// --- Content scan ------------------------------------------------------------
const isTextBuffer = (buf) => {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
  return true;
};

// files: [{ path, data }] relative to the package root.
const scanEntries = (files, targetName) => {
  const hits = [];
  for (const { path: rel, data } of files) {
    if (FORBIDDEN_FILES.test(rel)) {
      hits.push({ file: rel, category: 'forbidden-file', severity: 'high', line: 0, snippet: rel });
    }
    if (data.length > MAX_SCAN_BYTES || !isTextBuffer(data)) continue;
    const lines = data.toString('utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of PATTERNS) {
        if (p.skipScaffolders && SCAFFOLDER_PACKAGES.has(targetName)) continue;
        const m = p.re.exec(line);
        if (!m) continue;
        const snippet = p.redact
          ? `[redacted ${m[0].length}-char match]`
          : line.trim().slice(0, 160);
        hits.push({ file: rel, category: p.category, severity: p.severity, line: i + 1, snippet });
      }
    }
  }
  return hits;
};

// --- Pack + scan one tarball -------------------------------------------------
// spec: {name, dir} for a HEAD pack, or {name, version} for a published fetch.
// The unbuilt-dist guard lives in `declaredEntryPoints` (scripts/lib/pack.mjs):
// without it an unbuilt package packs manifest+README+LICENSE+NOTICE and scans
// as a false "clean".
const packAndScan = (spec, workDir) =>
  withPackedTarball(spec, workDir, ({ path }) => {
    const files = readTarball(path)
      .filter((e) => e.name.startsWith('package/'))
      .map((e) => ({ path: e.name.slice('package/'.length), data: e.data }))
      .filter((e) => e.path && !e.path.endsWith('/'));
    const manifestEntry = files.find((e) => e.path === 'package.json');
    if (!manifestEntry) return { ok: false, reason: 'tarball had no package/package.json' };
    const manifest = JSON.parse(manifestEntry.data.toString('utf8'));
    const filePaths = new Set(files.map((e) => e.path));
    const missingEntry = declaredEntryPoints(manifest).find((p) => !filePaths.has(p));
    if (missingEntry) {
      return {
        ok: false,
        reason: `tarball missing declared entry "${missingEntry}" (dist not built? run: bun run build)`,
      };
    }
    return {
      ok: true,
      license: manifest.license ?? '(none)',
      hasLicense: files.some((e) => e.path === 'LICENSE'),
      hasNotice: files.some((e) => e.path === 'NOTICE'),
      hits: scanEntries(files, spec.name),
    };
  });

// --- Published version discovery --------------------------------------------
const publishedVersions = (name) => {
  try {
    const parsed = JSON.parse(npm('view', name, 'versions', '--json'));
    return { ok: true, versions: (Array.isArray(parsed) ? parsed : [parsed]).map(String) };
  } catch (err) {
    return {
      ok: false,
      reason: String(err.stderr || err.message || err)
        .split('\n')[0]
        .trim(),
    };
  }
};

// --- Report ------------------------------------------------------------------
const sevRank = { high: 0, medium: 1, low: 2 };

const renderReport = ({ headRows, publishedRows, headHits, allHits, mode, stamp }) => {
  const lines = [];
  lines.push('# OSS-F3 — tarball + published-versions audit', '');
  lines.push(`_Generated ${stamp} · mode: ${mode} · gitignored (\`docs/plans/_local/\`)._`, '');
  lines.push(
    `HEAD hits: **${headHits.length}** (fix rows) · total hits incl. published: **${allHits.length}**.`,
    '',
  );

  lines.push(
    '## HEAD tarballs',
    '',
    '| package | version | license | LICENSE | NOTICE | hits |',
    '|---|---|---|---|---|---|',
  );
  for (const r of headRows) {
    if (!r.ok) {
      lines.push(`| ${r.name} | HEAD | — | — | — | ⚠ pack failed: ${r.reason} |`);
      continue;
    }
    const lic = r.license === 'Apache-2.0' ? '✅ Apache-2.0' : `❌ ${r.license}`;
    lines.push(
      `| ${r.name} | HEAD | ${lic} | ${r.hasLicense ? '✅' : '❌'} | ${r.hasNotice ? '✅' : '❌'} | ${r.hits.length || '—'} |`,
    );
  }
  lines.push('');

  lines.push('## Published tarballs (retroactively exposed by the flip)', '');
  lines.push('| package | version | fetched | license | hits |', '|---|---|---|---|---|');
  for (const r of publishedRows) {
    lines.push(
      `| ${r.name} | ${r.version} | ${r.fetched} | ${r.license ?? '—'} | ${r.hits == null ? '—' : r.hits || '—'} |`,
    );
  }
  lines.push('');

  lines.push('## Hit ledger', '');
  if (allHits.length === 0) {
    lines.push('_No hits._', '');
  } else {
    lines.push('| sev | scope | package | file:line | category | snippet | disposition |');
    lines.push('|---|---|---|---|---|---|---|');
    const sorted = [...allHits].sort(
      (a, b) => sevRank[a.severity] - sevRank[b.severity] || a.package.localeCompare(b.package),
    );
    for (const h of sorted) {
      const snip = h.snippet.replace(/\|/g, '\\|');
      lines.push(
        `| ${h.severity} | ${h.scope} | ${h.package} | ${h.file}:${h.line} | ${h.category} | ${snip} |  |`,
      );
    }
    lines.push('');
  }

  lines.push('## Notes', '');
  lines.push(
    '- HEAD hits = fix rows before freeze. Published-version hits = owner disposition (fill the ledger `disposition` column).',
  );
  lines.push('- Published 0.1.0–0.2.1 stay MIT by design (immutable) — recorded, not flagged.');
  lines.push(
    '- If published rows show "not fetched (auth required)", re-run authenticated: `bun scripts/audit-tarballs.mjs`.',
  );
  lines.push('');
  return lines.join('\n');
};

// --- Selftest ----------------------------------------------------------------
const runSelftest = () => {
  const dirty = [
    'built at C:\\_PROG\\flare-engine-workspace\\dist',
    'home /Users/someone/proj/x.ts',
    'token npm_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    'gh ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    '-----BEGIN RSA PRIVATE KEY-----',
    '-----BEGIN PGP PRIVATE KEY BLOCK-----',
    'key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ0123456',
    'process.env.NPM_TOKEN',
    'TESTINGBOT_SECRET=x',
    'https://u.expo.dev/202e2a64-a737-48c1-8d71-0e7b8b6a3395',
    'see Pan Tvardowski design',
    'ip berekMode spawnKogut JedzaBossState',
    'boss SmokBoss and smok_idle and spawnSmok',
    'appended to SESSION_LOG.md',
    'a classic shmup loop',
  ].join('\n');
  const clean = [
    'export const add = (a, b) => a + b;',
    '// A generic 2D engine for React Native + Web.',
    'import { Vec2 } from "@flare-engine/math";',
    'run the smoke test suite, a bit smoky and Smoke-heavy',
  ].join('\n');
  const files = [
    { path: 'dirty.ts', data: Buffer.from(dirty) },
    { path: 'clean.ts', data: Buffer.from(clean) },
    { path: '.npmrc', data: Buffer.from('//registry.npmjs.org/:_authToken=x') },
  ];

  const engineHits = scanEntries(files, '@flare-engine/demo');
  const scaffolderGenre = [...SCAFFOLDER_PACKAGES].flatMap((name) =>
    scanEntries(files, name).filter((h) => h.category === 'genre-coupling'),
  );
  const firedCats = new Set(engineHits.map((h) => h.category));
  const expected = [
    'local-path',
    'home-path',
    'npm-token',
    'gh-token',
    'private-key',
    'api-key',
    'auth-token-ref',
    'ci-secret',
    'private-url',
    'pt-vocab',
    'game-ip',
    'plan-ref',
    'genre-coupling',
    'forbidden-file',
  ];
  const missing = expected.filter((c) => !firedCats.has(c));
  const cleanHits = engineHits.filter((h) => h.file === 'clean.ts');

  const problems = [];
  if (missing.length) problems.push(`detector MISSED categories: ${missing.join(', ')}`);
  if (cleanHits.length)
    problems.push(`FALSE POSITIVE on clean.ts: ${cleanHits.map((h) => h.category).join(', ')}`);
  if (scaffolderGenre.length)
    problems.push('genre-coupling should be skipped for scaffolder packages but fired');

  if (problems.length) {
    console.error('audit-tarballs --selftest: FAILED');
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `audit-tarballs --selftest: OK — all ${expected.length} categories fire on planted samples, ` +
      'clean sample is silent, scaffolder packages genre-exempt.',
  );
  process.exit(0);
};

// --- Main --------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes('--selftest')) runSelftest();
const headOnly = argv.includes('--head-only');
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex !== -1 ? argv[onlyIndex + 1] : undefined;

const targets = discoverPublishTargets(only);
if (targets.length === 0) {
  console.error('[audit-tarballs] no publishable targets found under packages/');
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), 'f3-audit-'));
const headRows = [];
const publishedRows = [];
const allHits = [];
const headHits = [];

try {
  console.log(`[audit-tarballs] HEAD scan — ${targets.length} targets`);
  for (const t of targets) {
    const res = packAndScan({ name: t.name, dir: t.dir }, work);
    if (res.ok) {
      headRows.push({
        name: t.name,
        ok: true,
        license: res.license,
        hasLicense: res.hasLicense,
        hasNotice: res.hasNotice,
        hits: res.hits,
      });
      for (const h of res.hits) {
        const rec = { ...h, package: t.name, scope: 'HEAD' };
        allHits.push(rec);
        headHits.push(rec);
      }
      // A non-Apache HEAD manifest or a missing legal file is itself a HEAD hit.
      if (res.license !== 'Apache-2.0') headHits.push({ severity: 'high', package: t.name });
      if (!res.hasLicense || !res.hasNotice) headHits.push({ severity: 'high', package: t.name });
    } else {
      headRows.push({ name: t.name, ok: false, reason: res.reason });
      headHits.push({ severity: 'high', package: t.name });
    }
  }

  if (headOnly) {
    console.log('[audit-tarballs] --head-only: skipping published-version fetch');
  } else {
    console.log('[audit-tarballs] published-version scan (authenticated)');
    for (const t of targets) {
      if (t.flipsPublic) {
        publishedRows.push({
          name: t.name,
          version: '(never published)',
          fetched: 'n/a',
          hits: null,
        });
        continue;
      }
      const versions = publishedVersions(t.name);
      if (!versions.ok) {
        for (const v of PUBLISHED_VERSIONS_EXPECTED) {
          publishedRows.push({
            name: t.name,
            version: v,
            fetched: 'not fetched (auth required)',
            hits: null,
          });
        }
        continue;
      }
      for (const v of versions.versions) {
        const res = packAndScan({ name: t.name, version: v }, work);
        if (!res.ok) {
          publishedRows.push({
            name: t.name,
            version: v,
            fetched: `error: ${res.reason}`,
            hits: null,
          });
          continue;
        }
        publishedRows.push({
          name: t.name,
          version: v,
          fetched: 'yes',
          license: res.license,
          hits: res.hits.length,
        });
        for (const h of res.hits) allHits.push({ ...h, package: t.name, scope: `published@${v}` });
      }
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

const stamp = new Date().toISOString();
const mode = headOnly ? 'head-only' : 'head + published';
writeFileSync(
  REPORT_PATH,
  renderReport({ headRows, publishedRows, headHits, allHits, mode, stamp }),
);

console.log(`\n[audit-tarballs] report -> ${relative(ROOT, REPORT_PATH).replace(/\\/g, '/')}`);
console.log(`[audit-tarballs] HEAD hits: ${headHits.length} · total hits: ${allHits.length}`);
if (headHits.length > 0) {
  console.error('[audit-tarballs] HEAD hits present — these are fix rows before freeze.');
  process.exit(1);
}
console.log('[audit-tarballs] HEAD clean.');
process.exit(0);
