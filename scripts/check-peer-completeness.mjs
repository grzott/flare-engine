#!/usr/bin/env bun
/**
 * A package that re-exports another workspace package's surface must re-declare
 * that package's required peers, or a consumer installing only the outer package
 * resolves without them and crashes at runtime.
 *
 * Bun hides this: it installs peers that npm, pnpm and yarn do not, so every
 * in-workspace check passes while the published package is broken for everyone
 * else. It has now bitten twice — E-R1/NEW-1 on `@flare-engine/react` (the
 * reanimated peer reached transitively through rn-skia), and XR-12 on
 * `@flare-engine/engine`, which re-exports `GameView` and never declared the
 * reanimated peer that `GameView` requires.
 *
 * Exceptions below are judged, not blanket-suppressed: each names why the outer
 * package genuinely does not reach that peer. Add one only with a reason.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';

/** pkg -> peers it legitimately does not re-declare, with the reason. */
const ALLOWED = {
  '@flare-engine/iap-revenuecat': {
    // The adapter consumes only iap's non-React surface — no react import anywhere
    // in packages/iap-revenuecat/src.
    react: 'adapter uses no React surface',
  },
};

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pkgs = new Map();
for (const dir of readdirSync('packages')) {
  const file = `packages/${dir}/package.json`;
  if (existsSync(file)) pkgs.set(read(file).name, { dir, json: read(file) });
}

const failures = [];
for (const [name, { dir, json }] of pkgs) {
  const own = new Set(Object.keys(json.peerDependencies ?? {}));
  const allowed = ALLOWED[name] ?? {};
  for (const dep of Object.keys(json.dependencies ?? {})) {
    const target = pkgs.get(dep);
    if (target === undefined) continue;
    const meta = target.json.peerDependenciesMeta ?? {};
    for (const [peer, range] of Object.entries(target.json.peerDependencies ?? {})) {
      if (meta[peer]?.optional) continue;
      if (own.has(peer) || peer in allowed) continue;
      failures.push({ name, dir, peer, range, via: dep });
    }
  }
}

if (failures.length === 0) {
  console.log(
    `check-peer-completeness: OK — ${pkgs.size} packages, no undeclared transitive peers.`,
  );
  process.exit(0);
}
for (const f of failures) {
  console.error(
    `packages/${f.dir}/package.json: missing peer "${f.peer}": "${f.range}" — required by ${f.via}, which ${f.name} depends on.`,
  );
}
console.error(
  `\ncheck-peer-completeness: ${failures.length} undeclared peer(s). Add them, or add a justified entry to ALLOWED.`,
);
process.exit(1);
