/**
 * The leak patterns shared by the freeze-time detectors: `audit-tarballs.mjs`
 * scans published tarball bytes with them, `scan-history.mjs` scans git
 * history. One list, so a pattern added for one surface covers the other.
 *
 * Plain ESM, Bun- and Node-runnable. Importing this module has no side effects.
 */

// severity: high (must never ship) · medium (private IP) · low (advisory).
// redact: mask the matched value in the report (real secrets).
// skipScaffolders: legitimate in the public starter templates (e.g. "shmup").
export const PATTERNS = [
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
